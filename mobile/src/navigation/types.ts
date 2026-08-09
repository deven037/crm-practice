export type ModuleKey =
  | 'leads'
  | 'contacts'
  | 'accounts'
  | 'deals'
  | 'products'
  | 'tickets'
  | 'campaigns'
  | 'quotes';

export type ProductsStackParamList = {
  productsList: undefined;
  productsForm: { id?: string };
  productsDetail: { id: string };
};

export type LeadsStackParamList = {
  leadsList: undefined;
  leadsForm: { id?: string };
  leadsDetail: { id: string };
  leadConvertWizard: { id: string };
};

export type ContactsStackParamList = {
  contactsList: undefined;
  contactsForm: { id?: string };
  contactsDetail: { id: string };
};

export type AccountsStackParamList = {
  accountsList: undefined;
  accountsForm: { id?: string };
  accountsDetail: { id: string };
};

export type DealsStackParamList = {
  dealsBoard: undefined;
  dealsForm: { id?: string };
  dealsDetail: { id: string };
};

export type TicketsStackParamList = {
  ticketsList: undefined;
  ticketsForm: { id?: string };
  ticketsDetail: { id: string };
};

export type CampaignsStackParamList = {
  campaignsList: undefined;
  campaignsForm: { id?: string };
  campaignsDetail: { id: string };
};

export type QuotesStackParamList = {
  quotesList: undefined;
  quotesForm: { id?: string };
  quotesDetail: { id: string };
};

export type AuthStackParamList = {
  Login: undefined;
};

export type DrawerParamList = {
  Dashboard: undefined;
  LeadsStack: undefined;
  ContactsStack: undefined;
  AccountsStack: undefined;
  DealsStack: undefined;
  ProductsStack: undefined;
  TicketsStack: undefined;
  CampaignsStack: undefined;
  QuotesStack: undefined;
  Tasks: undefined;
  Admin: undefined;
  Settings: undefined;
};
