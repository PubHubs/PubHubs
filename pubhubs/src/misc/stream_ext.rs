//! Tools for dealing with streams

use std::pin::Pin;
use std::task::{Context, Poll};

use futures::stream::Stream;

/// Extension trait for [`Stream`]s
pub trait StreamExt: Stream + Sized {
    /// Yields items from the current, first, stream until an item from the `other`,
    /// second, stream becomes available.  At that point the first stream is dropped,
    /// and only items from the second stream are yielded.
    fn until_overridden_by<Other: Stream<Item = Self::Item>>(
        self,
        other: Other,
    ) -> UntilOverriddenBy<Self, Other>;

    /// Like [`futures::stream::Fuse`], but can be 'tripped' to cut the stream short.
    fn breaker(self) -> Breaker<Self>;

    /// Relays this stream over a channel so that a `!Send` stream — e.g. one tied to a single-threaded
    /// runtime — can be consumed from anywhere a `Send + Sync` stream is required.
    ///
    /// A background *pump* task forwards each item over the channel; this method spawns it with
    /// [`tokio::task::spawn_local`], so it must be called from within a [`tokio::task::LocalSet`].
    /// `capacity` bounds how many items may buffer ahead of a slow consumer.
    ///
    /// Each source item is yielded as `Ok`.  If the pump or source is dropped before the source is
    /// exhausted (e.g. its runtime is torn down mid-relay), the final item is `Err(`[`Truncated`]`)` —
    /// so a stream cut short can never be mistaken for a clean end.  See also [`SyncStream::new`],
    /// which hands back the pump for you to drive yourself.
    fn sync(self, capacity: std::num::NonZero<usize>) -> SyncStream<Result<Self::Item, Truncated>>
    where
        Self: 'static,
        Self::Item: Send + 'static;
}

impl<S: Stream> StreamExt for S {
    fn until_overridden_by<Other: Stream<Item = Self::Item>>(
        self,
        other: Other,
    ) -> UntilOverriddenBy<Self, Other> {
        UntilOverriddenBy {
            a: self.breaker(),
            b: other.breaker(),
        }
    }

    fn breaker(self) -> Breaker<Self> {
        Breaker { inner: Some(self) }
    }

    fn sync(self, capacity: std::num::NonZero<usize>) -> SyncStream<Result<Self::Item, Truncated>>
    where
        Self: 'static,
        Self::Item: Send + 'static,
    {
        let (pump, stream) = SyncStream::new(self, capacity);
        tokio::task::spawn_local(pump);
        stream
    }
}

pin_project_lite::pin_project! {
/// Return type of [`StreamExt::breaker`]
pub struct Breaker<S : Stream>{
#[pin]
inner: Option<S>
}
}

impl<S: Stream> Stream for Breaker<S> {
    type Item = S::Item;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let Some(s) = self.as_mut().project().inner.as_pin_mut() else {
            return Poll::Ready(None);
        };

        let result = s.poll_next(cx);

        if matches!(result, Poll::Ready(None)) {
            self.trip();
        }

        result
    }
}

impl<S: Stream> futures::stream::FusedStream for Breaker<S> {
    fn is_terminated(&self) -> bool {
        self.inner.is_none()
    }
}

impl<S: Stream> Breaker<S> {
    /// Drop the underlying stream (if it was not already);
    /// [`Stream::poll_next`] will return `Poll::Ready(None)` from this point onwards.
    pub fn trip(self: Pin<&mut Self>) {
        self.project().inner.set(None)
    }
}

pin_project_lite::pin_project! {
/// Return type of [`StreamExt::until_overridden_by`].
pub struct UntilOverriddenBy<A, B>
where
    A: Stream,
    B: Stream<Item = A::Item>,
{
    #[pin]
    a: Breaker<A>,
    #[pin]
    b: Breaker<B>,
}
}

impl<A, B> Stream for UntilOverriddenBy<A, B>
where
    A: Stream,
    B: Stream<Item = A::Item>,
{
    type Item = A::Item;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.project();

        // As soon as b yields an item it overrides a for good: drop a (and its remaining items) and
        // yield b's item.  Both fields are `Breaker`s, so re-polling either after it has finished is
        // safe and cheap — a finished breaker returns `Ready(None)` again without touching its inner
        // stream — which is what lets us poll unconditionally below.
        let from_b = this.b.as_mut().poll_next(cx);
        if let Poll::Ready(Some(_)) = from_b {
            this.a.as_mut().trip();
            return from_b;
        }

        // b produced nothing; yield from a while it still has items.  After an override a's breaker is
        // tripped, so this just returns `Ready(None)` — meaning no item from a is ever returned after
        // an item from b.
        let from_a = this.a.as_mut().poll_next(cx);
        if let Poll::Ready(Some(_)) = from_a {
            return from_a;
        }

        // Neither produced an item.  End only once *both* breakers are exhausted; while either is still
        // pending it may yet yield (b may override), so wait.  (A breaker reporting `Ready(None)` does
        // not mean its underlying stream ran out — a's is tripped on override while it may still have
        // had items.)  The polls above registered the wakers we need.
        match (from_a, from_b) {
            (Poll::Ready(None), Poll::Ready(None)) => Poll::Ready(None),
            _ => Poll::Pending,
        }
    }
}

impl<A: Stream, B: Stream<Item = A::Item>> futures::stream::FusedStream
    for UntilOverriddenBy<A, B>
{
    fn is_terminated(&self) -> bool {
        self.a.is_terminated() && self.b.is_terminated()
    }
}

/// Marks that a [`SyncStream`] was cut short: its pump (or source) was dropped before the source
/// finished, so the `Ok` items before it are only a prefix of the source.  By contract it is the final
/// item the stream yields — nothing follows it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Truncated;

impl std::fmt::Display for Truncated {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("the stream was truncated: its pump was dropped before the source finished")
    }
}

impl std::error::Error for Truncated {}

/// A `Send + Sync` stream of `T`, fed over a channel by a *pump* (a future) running on the source's
/// thread — letting a `!Send` source stream be consumed where `Send`/`Sync` is required.
///
/// Its constructors, [`SyncStream::new`] and [`StreamExt::sync`], relay a source stream and set
/// `T = Result<SourceItem, `[`Truncated`]`>`: each source item is yielded as `Ok`, and a final
/// `Err(Truncated)` appears if the pump or source is dropped before the source is exhausted — so a
/// stream cut short can't be mistaken for a clean end.
pub struct SyncStream<T> {
    receiver: tokio::sync::mpsc::Receiver<T>,
}

impl<U> SyncStream<Result<U, Truncated>> {
    /// Relays `source` into a `Send + Sync` [`SyncStream`], returning it together with the *pump*: a
    /// future that forwards each source item (as `Ok`) over a channel bounded to `capacity`, so a slow
    /// consumer exerts backpressure rather than letting the pump buffer the whole source.
    ///
    /// The pump must be driven on the thread where `source` lives — typically with
    /// [`tokio::task::spawn_local`].  Until it is driven the stream yields nothing.  If the pump or
    /// source is dropped before `source` is exhausted — including if the pump is never driven at all —
    /// the stream's final item is `Err(`[`Truncated`]`)`; on a clean finish only `Ok` items appear.
    #[must_use = "drive the returned pump (e.g. with spawn_local); dropping it undriven makes the stream yield only Err(Truncated)"]
    pub fn new<S>(
        source: S,
        capacity: std::num::NonZero<usize>,
    ) -> (impl std::future::Future<Output = ()>, Self)
    where
        S: Stream<Item = U> + 'static,
        U: Send + 'static,
    {
        // One extra slot, reserved up front, lets a dropped pump always deliver the `Truncated` marker
        // even when the channel is full.
        let (sender, receiver) = tokio::sync::mpsc::channel(capacity.get().saturating_add(1));

        // Arm a drop bomb — before the pump is even polled — that delivers `Truncated` over the
        // reserved slot if the pump is dropped before the source is exhausted.  Every clean exit
        // defuses it; either way its permit (and the sender clone it holds) is released, so the channel
        // can close and the receiver sees the end.
        let mut truncate_on_drop = crate::misc::drop_ext::Bomb::new({
            let permit = sender.clone().try_reserve_owned().ok();
            move || {
                if let Some(permit) = permit {
                    permit.send(Err(Truncated));
                }
            }
        });

        let pump = async move {
            use futures::StreamExt as _;

            let mut source = std::pin::pin!(source);
            while let Some(item) = source.next().await {
                // `send` only errors once the consumer (this `SyncStream`) has been dropped — there is
                // then no one left to tell, so we stop without marking truncation.
                if sender.send(Ok(item)).await.is_err() {
                    truncate_on_drop.defuse();
                    return;
                }
            }
            // The source is exhausted: a clean end.
            truncate_on_drop.defuse();
        };

        (pump, Self { receiver })
    }
}

// This forward to `poll_recv` makes `SyncStream` a hand-rolled `tokio_stream::wrappers::ReceiverStream`.
// We keep the newtype deliberately: it stays a documented named type in signatures (the natural home for
// the `Truncated` contract above) and avoids enabling tokio-stream's `sync` feature, at the cost of these
// few lines — a forward to a stable API that needs no maintenance.
impl<T> Stream for SyncStream<T> {
    type Item = T;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<T>> {
        self.get_mut().receiver.poll_recv(cx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::StreamExt as _;

    fn chan(
        items: &[i32],
    ) -> (
        futures::channel::mpsc::UnboundedSender<i32>,
        impl Stream<Item = i32>,
    ) {
        let (tx, rx) = futures::channel::mpsc::unbounded();
        for &item in items {
            tx.unbounded_send(item).unwrap();
        }
        (tx, rx)
    }

    /// B overrides A after A yields; the remaining item in A is dropped
    #[test]
    fn b_overrides_a() {
        let (a_tx, a) = chan(&[1, 2, 3]); // 3 will be overridden; B starts pending
        let (b_tx, b) = chan(&[]);
        let mut s = a.until_overridden_by(b);

        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(1));
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(2));

        b_tx.unbounded_send(10).unwrap();
        drop(b_tx);

        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(10));
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), None);

        assert!(a_tx.unbounded_send(99).is_err()); // A (and its buffered 3) was dropped
    }

    /// After b overrides a, a *pending* gap from b must not end the stream.  (The bug: it polled the
    /// now-tripped a, got `Ready(None)`, and ended early — dropping b's later items.)
    #[test]
    fn b_keeps_overriding_across_a_pending_gap() {
        let (a_tx, a) = chan(&[1, 2]); // 2 will be dropped on override
        let (b_tx, b) = chan(&[]);
        let mut s = a.until_overridden_by(b);

        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(1));

        b_tx.unbounded_send(10).unwrap(); // b overrides a
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(10));

        // b is alive but has nothing yet: the stream must wait for it, not end.
        tokio_test::assert_pending!(tokio_test::task::spawn(s.next()).poll());

        b_tx.unbounded_send(20).unwrap();
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(20));

        drop(b_tx);
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), None);

        assert!(a_tx.unbounded_send(99).is_err()); // a was dropped on override
    }

    /// B ends without overriding; A is not dropped and continues
    #[test]
    fn b_ends_without_overriding() {
        let (a_tx, a) = chan(&[]);
        let (b_tx, b) = chan(&[]);
        drop(b_tx); // B ends immediately
        let mut s = a.until_overridden_by(b);

        a_tx.unbounded_send(1).unwrap();
        a_tx.unbounded_send(2).unwrap();
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(1));
        tokio_test::assert_ready_eq!(tokio_test::task::spawn(s.next()).poll(), Some(2));
        assert!(a_tx.unbounded_send(99).is_ok()); // A was not dropped
    }

    /// Both pending — stream is pending
    #[test]
    fn both_pending() {
        let (_a_tx, a) = chan(&[]);
        let (_b_tx, b) = chan(&[]);
        let mut s = a.until_overridden_by(b);
        tokio_test::assert_pending!(tokio_test::task::spawn(s.next()).poll());
    }

    /// `sync` bridges a `!Send` source into a `Send + Sync` stream, relaying every item as `Ok`.
    #[tokio::test]
    async fn sync_relays_a_non_send_source() {
        fn assert_send_sync<T: Send + Sync>(_: &T) {}

        tokio::task::LocalSet::new()
            .run_until(async {
                // A `!Send` source: the `map` closure captures an `Rc`.
                let shared = std::rc::Rc::new(vec![10, 20, 30]);
                let mut synced = futures::stream::iter(0..shared.len())
                    .map(move |i| shared[i])
                    .sync(std::num::NonZero::new(4).unwrap());
                assert_send_sync(&synced); // it crossed the `!Send` boundary

                let mut got = Vec::new();
                while let Some(item) = synced.next().await {
                    got.push(item.expect("the source was not truncated"));
                }
                assert_eq!(got, [10, 20, 30]);
            })
            .await;
    }

    /// A pump dropped before it is ever driven yields `Err(Truncated)` and nothing else.
    #[tokio::test]
    async fn an_undriven_dropped_pump_truncates() {
        let source = futures::stream::iter([1, 2, 3]);
        let (pump, mut synced) = SyncStream::new(source, std::num::NonZero::new(4).unwrap());
        drop(pump);
        assert_eq!(synced.next().await, Some(Err(Truncated)));
        assert_eq!(synced.next().await, None);
    }

    /// Aborting the pump mid-stream delivers the items already sent, then exactly one final
    /// `Err(Truncated)`.
    #[tokio::test]
    async fn aborting_mid_stream_truncates_after_the_buffered_items() {
        let source = futures::stream::iter(0..1000); // far more than we will drain
        let (pump, mut synced) = SyncStream::new(source, std::num::NonZero::new(4).unwrap());
        let pump = tokio::spawn(pump);

        assert_eq!(synced.next().await, Some(Ok(0)));
        assert_eq!(synced.next().await, Some(Ok(1)));
        pump.abort();

        let mut last = None;
        let mut errors = 0;
        while let Some(item) = synced.next().await {
            if item.is_err() {
                errors += 1;
            }
            last = Some(item);
        }
        assert_eq!(last, Some(Err(Truncated)));
        assert_eq!(errors, 1);
    }

    /// A dropped consumer makes the pump stop (its `send` fails); it exits without marking truncation,
    /// since no one is left to read it.
    #[tokio::test]
    async fn pump_exits_when_the_consumer_is_dropped() {
        let source = futures::stream::iter(0..1000);
        let (pump, mut synced) = SyncStream::new(source, std::num::NonZero::new(4).unwrap());
        let pump = tokio::spawn(pump);

        assert_eq!(synced.next().await, Some(Ok(0)));
        assert_eq!(synced.next().await, Some(Ok(1)));
        drop(synced);

        tokio::time::timeout(std::time::Duration::from_secs(1), pump)
            .await
            .expect("the pump should exit after the consumer is dropped")
            .expect("the pump task should not panic");
    }
}
