use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs as _};
use url::Url;

use indexmap::{IndexMap, IndexSet};

/// A value that can be resolved to an [`IpAddr`].
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case")]
pub enum HostAlias {
    /// Literally, this [`IpAddr`].
    Ip(IpAddr),

    /// The default source IP address when contacting the by [`UrlPwa`] specified host.
    ///
    /// The `scheme` must be either `tcp` or `udp`, and a `port` must be specified.
    /// The url cannot have a `username`, `password`, `path`, `query` or `fragment`.
    SourceIpFor(UrlPwa),
}

impl HostAlias {
    /// If [`HostAlias`] has been resolved to an [`IpAddr`], return that ip address.
    fn as_ip(&self) -> Option<&IpAddr> {
        match self {
            HostAlias::Ip(ref ip) => Some(ip),
            _ => None,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Default)]
#[serde(transparent)]
pub struct HostAliases {
    inner: IndexMap<String, HostAlias>,
}

/// A [`Url`] that perhaps has as host name one of the aliases defined in [`super::Config::host_aliases`].
#[derive(Debug, Clone)]
pub enum UrlPwa {
    /// The host name of the [`Url`] might contain an alias.
    PerhapsWithAlias(Url),

    /// Any alias has been replaced.
    WithoutAlias(Url),
}

impl HostAliases {
    /// Resolves all host aliases to [`IpAddr`]esses.
    pub fn resolve_all(&mut self) -> anyhow::Result<()> {
        Resolver::new(&mut self.inner).resolve_all()?;
        Ok(())
    }

    /// Resolves the given [`UrlPwa`] to one without any aliases.
    ///
    /// Requires that [`HostAliases::resolve_all`] has been called.
    pub fn dealias(&self, url_pwa: &mut UrlPwa) {
        let mut url: Url = match url_pwa {
            UrlPwa::WithoutAlias(_) => {
                return; // no alias there
            }
            UrlPwa::PerhapsWithAlias(url) => url.clone(),
        };

        'dealias: {
            if let Some(host) = url.host() {
                // get ip address from host
                let ip: IpAddr = match host {
                    url::Host::Ipv4(ip) => ip.into(),
                    url::Host::Ipv6(ip) => ip.into(),
                    url::Host::Domain(hostname) => {
                        if let Some(ha) = self.inner.get(hostname) {
                            *ha.as_ip().unwrap()
                        } else {
                            break 'dealias; // host not an alias
                        }
                    }
                };

                url.set_ip_host(ip)
                    .expect("unexpectedly could not set host of an url that had a host already");
            }
        }

        *url_pwa = UrlPwa::WithoutAlias(url);
    }
}

/// Helper struct for [`HostAliases::resolve_all`]
struct Resolver<'a> {
    aliases: &'a mut IndexMap<String, HostAlias>,

    /// The indices of [`Resolver::aliases`] that still have to be resolved,
    /// including the alias(es) currently under consideration.
    todo: std::collections::HashSet<usize>,

    /// The indices of [`Resolver::aliases`] that are currently being resolved.
    deps_stack: IndexSet<usize>,
}

impl<'a> Resolver<'a> {
    fn new(aliases: &'a mut IndexMap<String, HostAlias>) -> Self {
        let n = aliases.len();
        Self {
            aliases,
            todo: (0..n).collect(),
            deps_stack: Default::default(),
        }
    }

    fn resolve_all(mut self) -> anyhow::Result<()> {
        while !self.todo.is_empty() {
            let hai: usize = *self.todo.iter().next().unwrap();
            self.resolve_new_one(hai)?;
        }
        Ok(())
    }

    fn resolve_new_one(&mut self, hai: usize) -> anyhow::Result<()> {
        assert_eq!(self.deps_stack.len(), 0);

        self.deps_stack = indexmap::indexset![hai];

        while !self.deps_stack.is_empty() {
            self.deps_stack_step()?;
        }

        Ok(())
    }

    fn deps_stack_step(&mut self) -> anyhow::Result<()> {
        let latest_ha: usize = *self.deps_stack.last().unwrap();

        if let Err(depi) = self.try_resolve_ha(latest_ha)? {
            let already_a_dep: bool = !self.deps_stack.insert(depi);
            anyhow::ensure!(
                !already_a_dep,
                "cyclic dependency involving host alias {}",
                self.aliases.get_index_entry(depi).unwrap().key(),
            );
            return Ok(());
        }

        assert_eq!(self.deps_stack.pop().unwrap(), latest_ha);
        self.todo.remove(&latest_ha);

        Ok(())
    }

    /// Tries to resolve the named host alias.  If this host alias
    /// depends on another unresolved host alias, returns the index of that alias in `Ok(Err(...))`.
    fn try_resolve_ha(&mut self, hai: usize) -> anyhow::Result<Result<(), usize>> {
        let ha: &HostAlias = self.aliases.get_index(hai).unwrap().1;

        let ip: IpAddr = match ha {
            HostAlias::Ip(_) => return Ok(Ok(())), // already resolved
            HostAlias::SourceIpFor(ref url_pwa) => {
                let url_pwa = match self.try_dealias_url_pwa(url_pwa.clone()) {
                    Ok(url_pwa) => url_pwa,
                    Err(dep) => return Ok(Err(dep)),
                };
                source_ip_for(url_pwa.as_ref())?
            }
        };

        let ha: &mut HostAlias = self.aliases.get_index_mut(hai).unwrap().1;
        *ha = HostAlias::Ip(ip);

        Ok(Ok(()))
    }

    fn try_dealias_url_pwa(&mut self, url: UrlPwa) -> Result<UrlPwa, usize> {
        let mut url: Url = match url {
            UrlPwa::WithoutAlias(url) => {
                return Ok(UrlPwa::WithoutAlias(url));
            }
            UrlPwa::PerhapsWithAlias(url) => url,
        };

        if let Some(host) = url.host() {
            let ip: IpAddr = match host {
                url::Host::Domain(hostname) => {
                    // If `hostname` is an alias, get its index and `HostAlias`.
                    let (idx, ha): (usize, &HostAlias) =
                        if let Some((idx, _, ha)) = self.aliases.get_full(hostname) {
                            (idx, ha)
                        } else {
                            return Ok(UrlPwa::WithoutAlias(url));
                        };

                    if self.todo.contains(&idx) {
                        // We could already detect a cyclic dependency here, but the return type
                        // would become less readable.
                        return Err(idx);
                    }

                    *ha.as_ip().unwrap()
                }
                url::Host::Ipv4(ip) => ip.into(),
                url::Host::Ipv6(ip) => ip.into(),
            };

            url.set_ip_host(ip)
                .expect("unexpectedly could not set host of an url that had a host already");
        }

        Ok(UrlPwa::WithoutAlias(url))
    }
}

/// Determines which [`IpAddr`] is used to contact the given address encoded in a [`Url`] with as
/// scheme either `tcp` or `udp`.  The _port_ of the url must be specified, but the _fragment_,
/// _query_, _username_ and _password_ cannot be set, and _path_ must be trivial.
fn source_ip_for(url: &Url) -> anyhow::Result<IpAddr> {
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

impl UrlPwa {
    /// Returns underlying [`Url`] which may, or may not (anymore) contain an host alias.
    fn url_perhaps_with_alias(&self) -> &Url {
        match self {
            UrlPwa::PerhapsWithAlias(ref u) | UrlPwa::WithoutAlias(ref u) => u,
        }
    }
}

impl From<Url> for UrlPwa {
    fn from(url: Url) -> Self {
        UrlPwa::WithoutAlias(url)
    }
}

impl std::fmt::Display for UrlPwa {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        self.url_perhaps_with_alias().fmt(f)
    }
}

impl serde::Serialize for UrlPwa {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        self.url_perhaps_with_alias().serialize(s)
    }
}

impl<'de> serde::Deserialize<'de> for UrlPwa {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Ok(UrlPwa::PerhapsWithAlias(Url::deserialize(d)?))
    }
}

impl AsRef<Url> for UrlPwa {
    fn as_ref(&self) -> &url::Url {
        if let UrlPwa::WithoutAlias(ref url) = self {
            return url;
        }
        panic!("internal error: url {self} is used but might still contain a host alias.  it should have been dealiased during configuration processing.");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_aliases() {
        let mut has: HostAliases = toml::from_str(
            r#"
        [localhost2]
        source_ip_for = "udp://localhost:1234"

        [localhost]
        ip = "127.0.0.1"

        [localhost3] 
        source_ip_for = "udp://localhost2:1234"

        [localhost4]
        source_ip_for = "udp://[::1]:3"

        "#,
        )
        .unwrap();

        has.resolve_all().unwrap();

        let mut url =
            UrlPwa::PerhapsWithAlias(Url::parse("https://localhost3:1234/dsa?asd#pwa").unwrap());

        has.dealias(&mut url);

        assert_eq!(
            url.as_ref().to_string(),
            "https://127.0.0.1:1234/dsa?asd#pwa"
        );

        let mut url =
            UrlPwa::PerhapsWithAlias(Url::parse("https://localhost4:1234/dsa?asd#pwa").unwrap());

        has.dealias(&mut url);

        assert_eq!(url.as_ref().to_string(), "https://[::1]:1234/dsa?asd#pwa");
    }
}
