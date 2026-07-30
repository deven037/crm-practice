export type ModuleKey =
  | 'leads'
  | 'contacts'
  | 'accounts'
  | 'deals'
  | 'products'
  | 'tickets'
  | 'campaigns'
  | 'quotes';

export type ModulesStackParamList = {
  ModulesMenu: undefined;
} & {
  [K in ModuleKey as `${K}List`]: undefined;
} & {
  [K in ModuleKey as `${K}Form`]: { id?: string };
} & {
  [K in ModuleKey as `${K}Detail`]: { id: string };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Settings: undefined;
  HelpWebView: undefined;
  Admin: undefined;
  ObjectConfig: { module: ModuleKey };
  TestCatalog: undefined;
};

export type AppTabsParamList = {
  Dashboard: undefined;
  Modules: undefined;
  Tasks: undefined;
  More: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};
