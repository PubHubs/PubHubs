# Specific info for developing the App

## Set networkhost.ip for iOS

The networkhost.ip set in pubhubs.toml (or pubhubs.default.toml) must also be set in `ios/App/App/Info.plist`.
Search for 'networkhost.ip' in the Info.plist.
Should look like this under <key>NSAppTransportSecurity</key>:

<key>145.137.183.102</key>  <---- THIS IS THE KEY TO UPDATE
<dict>
    <key>NSExceptionAllowsInsecureHTTPLoads</key>
    <true/>
    <key>NSIncludesSubdomains</key>
    <false/>
</dict>

