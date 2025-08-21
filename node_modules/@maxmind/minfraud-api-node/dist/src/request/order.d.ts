/// <reference types="node" />
import { URL } from 'url';
interface OrderProps {
    amount?: number;
    currency?: string;
    discountCode?: string;
    affiliateId?: string;
    subaffiliateId?: string;
    referrerUri?: URL;
    isGift?: boolean;
    hasGiftMessage?: boolean;
}
export default class Order implements OrderProps {
    amount?: number;
    currency?: string;
    discountCode?: string;
    affiliateId?: string;
    subaffiliateId?: string;
    referrerUri?: URL;
    isGift?: boolean;
    hasGiftMessage?: boolean;
    constructor(order: OrderProps);
}
export {};
