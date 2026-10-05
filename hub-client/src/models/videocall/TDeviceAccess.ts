// Whether the browser has handed us the microphone and camera yet.
//
// 'pending'     - waiting for the user to answer the browser's permission prompt
// 'granted'     - at least one input device is available to us
// 'denied'      - the user refused, or the site is blocked in the browser settings
// 'unavailable' - permission is not the problem, the machine simply has no usable input device
type TDeviceAccess = 'pending' | 'granted' | 'denied' | 'unavailable';

// Which permission notice to show. Each value has a matching pair of
// `videocall.permission_<value>_title` / `_body` copy.
//
// Everything but 'screenshare' mirrors the device access state above; 'screenshare' covers the
// browser's display picker being dismissed, or capture not being allowed at all.
type TPermissionNotice = Exclude<TDeviceAccess, 'granted'> | 'screenshare';

export { type TDeviceAccess, type TPermissionNotice };
