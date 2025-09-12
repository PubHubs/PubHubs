use super::server::*;

use std::rc::Rc;

use crate::api::{self};

impl App {
    pub async fn handle_yivi_wait_for_result(
        _app: Rc<Self>,
    ) -> api::Result<api::auths::YiviWaitForResultResp> {
        todo! {}
    }
}
