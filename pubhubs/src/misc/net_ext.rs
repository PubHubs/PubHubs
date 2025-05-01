use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs as _};

use url::Url;

/// Determines the IP address of the network interface used by this host to contact the broader internet.
///
/// This is likely a private IP only reachable via the local network (if behind a NAT).
pub fn source_ip() -> anyhow::Result<IpAddr> {
    source_ip_for(&Url::parse("udp://k.root-servers.net:53").unwrap())
}

/// Determines which [`IpAddr`] is used to contact the given address encoded in a [`Url`] with as
/// scheme either `tcp` or `udp`.  The _port_ of the url must be specified, but the _fragment_,
/// _query_, _username_ and _password_ cannot be set, and _path_ must be trivial.
pub fn source_ip_for(url: &Url) -> anyhow::Result<IpAddr> {
    anyhow::ensure!(
        url.fragment().is_none(),
        "this url cannot contain fragment (i.e. '#')"
    );
    anyhow::ensure!(
        url.query().is_none(),
        "this url cannot contain query (i.e. '?')",
    );
    anyhow::ensure!(url.password().is_none(), "this url cannot contain password",);
    anyhow::ensure!(url.username() == "", "this url cannot contain username",);
    anyhow::ensure!(
        matches!(url.path(), "" | "/"),
        "this url must have a trivial path",
    );

    let port: u16 = url
        .port()
        .ok_or_else(|| anyhow::anyhow!("this url must contain a port number"))?;

    let sas: Vec<SocketAddr> = match url.host() {
        None => anyhow::bail!("this url must contain a host"),
        Some(url::Host::Ipv4(ip)) => (ip, port).to_socket_addrs()?.collect(),
        Some(url::Host::Ipv6(ip)) => (ip, port).to_socket_addrs()?.collect(),
        Some(url::Host::Domain(domain)) => (domain, port).to_socket_addrs()?.collect(),
    };

    for sa in sas {
        match source_ip_for_sa(sa, url.scheme()) {
            Ok(ip) => return Ok(ip),
            Err(err) => {
                log::warn!(
                    "failed to get source ip address for contacting port {port} of {:?}: {err}",
                    url.host()
                );
            }
        }
    }

    anyhow::bail!(
        "could not obtain a source ip address for any of the ip addresses associated to {:?}",
        url.host()
    );
}

fn source_ip_for_sa(sa: SocketAddr, scheme: &str) -> anyhow::Result<IpAddr> {
    let unspecified_ip: IpAddr = if sa.is_ipv4() {
        Ipv4Addr::UNSPECIFIED.into()
    } else {
        Ipv6Addr::UNSPECIFIED.into()
    };

    match scheme {
        "udp" => {
            let sock = std::net::UdpSocket::bind((unspecified_ip, 0))?;
            sock.connect(sa)?;
            Ok(sock.local_addr()?.ip())
        }
        "tcp" => {
            let stream = std::net::TcpStream::connect(sa)?;
            Ok(stream.local_addr()?.ip())
        }
        _ => anyhow::bail!("invalid url scheme '{}'; must be 'tcp' or 'udp'", scheme),
    }
}
