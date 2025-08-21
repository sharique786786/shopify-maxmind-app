interface AccountProps {
    userId?: string;
    username?: string;
}
export default class Account {
    userId?: string;
    usernameMd5?: string;
    constructor(account: AccountProps);
}
export {};
