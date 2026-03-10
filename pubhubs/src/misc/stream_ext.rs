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
        let this = self.project();

        // b.poll_next is cheap when b is terminated
        match this.b.poll_next(cx) {
            Poll::Pending | Poll::Ready(None) => this.a.poll_next(cx),
            result @ Poll::Ready(Some(..)) => {
                this.a.trip();
                result
            }
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
}
