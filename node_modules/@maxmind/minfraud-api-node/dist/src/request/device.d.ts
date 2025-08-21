interface DeviceProps {
    ipAddress?: string;
    userAgent?: string;
    acceptLanguage?: string;
    sessionAge?: number;
    sessionId?: string;
}
export default class Device implements DeviceProps {
    ipAddress?: string;
    userAgent?: string;
    acceptLanguage?: string;
    sessionAge?: number;
    sessionId?: string;
    constructor(device: DeviceProps);
}
export {};
