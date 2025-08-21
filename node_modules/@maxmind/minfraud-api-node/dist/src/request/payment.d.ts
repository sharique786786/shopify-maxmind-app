import { Processor } from '../constants';
interface PaymentProps {
    processor?: Processor;
    wasAuthorized?: boolean;
    declineCode?: string;
}
export default class Payment implements PaymentProps {
    processor?: Processor;
    wasAuthorized?: boolean;
    declineCode?: string;
    constructor(payment: PaymentProps);
}
export {};
