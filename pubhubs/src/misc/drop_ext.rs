/// A [Bomb] instance will panic if it is not [Bomb::diffuse]d.
///
/// Add a [Bomb] to your type to make sure that something happens before
/// the type (and thus bomb) is dropped.
pub struct Bomb {
    payload: Option<Box<dyn FnOnce() -> String>>,
}

impl Bomb {
    pub fn new(msg: impl FnOnce() -> String + 'static) -> Self {
        Self {
            payload: Some(Box::new(msg)),
        }
    }

    pub fn diffuse(mut self) {
        self.payload = None
    }
}

impl Drop for Bomb {
    fn drop(&mut self) {
        if let Some(msg) = self.payload.take() {
            let message = (msg)();

            log::error!("{}", message);

            if !std::thread::panicking() {
                panic!("{}", message);
            }
        }
    }
}
