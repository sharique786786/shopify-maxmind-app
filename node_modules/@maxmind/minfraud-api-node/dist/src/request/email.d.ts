interface EmailProps {
    address?: string;
    domain?: string;
    hashAddress?: boolean;
}
export default class Email implements EmailProps {
    address?: string;
    domain?: string;
    private static readonly typoDomains;
    constructor(email: EmailProps);
    private cleanEmailAddress;
    private cleanDomain;
}
export {};
