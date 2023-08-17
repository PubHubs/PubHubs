macro_rules! for_all_servers_helper {
  ($mcro:ident $($server:ident)*) => { $($mcro!($server); )* }
}

/// Invokes given macro once for each pubhubs server with the server's identifier as argument.
macro_rules! for_all_servers {
  ( $x:ident ) => { $crate::servers::macros::for_all_servers_helper!($x phc transcryptor) }
}

pub(crate) use {for_all_servers, for_all_servers_helper};
