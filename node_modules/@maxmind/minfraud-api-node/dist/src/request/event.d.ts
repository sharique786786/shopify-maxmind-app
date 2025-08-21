import { EventType } from '../constants';
interface EventProps {
    transactionId?: string;
    shopId?: string;
    time?: Date;
    type?: EventType;
}
export default class Event implements EventProps {
    transactionId?: string;
    shopId?: string;
    time?: Date;
    type?: EventType;
    constructor(minfraudEvent: EventProps);
}
export {};
