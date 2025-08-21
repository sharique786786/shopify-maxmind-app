export interface LocationProps {
    firstName?: string;
    lastName?: string;
    company?: string;
    address?: string;
    address2?: string;
    city?: string;
    region?: string;
    country?: string;
    postal?: string;
    phoneNumber?: string;
    phoneCountryCode?: string;
}
export default class Location implements LocationProps {
    firstName?: string;
    lastName?: string;
    company?: string;
    address?: string;
    address2?: string;
    city?: string;
    region?: string;
    country?: string;
    postal?: string;
    phoneNumber?: string;
    phoneCountryCode?: string;
    constructor(location: LocationProps);
}
