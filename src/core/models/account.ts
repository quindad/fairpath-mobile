export type AccountType =
  | 'member'
  | 'employer'
  | 'property_owner'
  | 'organization'
  | 'admin';

export type FairPathAccount = {
  id: string;
  accountType: AccountType;
  firstName: string | null;
  lastName: string | null;
};
