export const COMPANIES = [
  { name: 'Vodafone', color: 'bg-company-vodafone', text: 'text-red-400' },
  { name: 'YesBank', color: 'bg-company-yesbank', text: 'text-blue-400' },
  { name: 'Cred', color: 'bg-company-cred', text: 'text-purple-400' },
  { name: 'TCS', color: 'bg-company-tcs', text: 'text-cyan-400' },
  { name: 'Reliance', color: 'bg-company-reliance', text: 'text-orange-400' },
  { name: 'Infosys', color: 'bg-company-infosys', text: 'text-green-400' },
] as const

export const COMPANY_COLOR: Record<string, string> = {
  Vodafone: 'bg-company-vodafone',
  YesBank: 'bg-company-yesbank',
  Cred: 'bg-company-cred',
  TCS: 'bg-company-tcs',
  Reliance: 'bg-company-reliance',
  Infosys: 'bg-company-infosys',
}

export const COMPANY_TEXT_COLOR: Record<string, string> = {
  Vodafone: 'text-red-400',
  YesBank: 'text-blue-400',
  Cred: 'text-purple-400',
  TCS: 'text-cyan-400',
  Reliance: 'text-orange-400',
  Infosys: 'text-green-400',
}

/** 1-based company_num for the backend API */
export const COMPANY_NUM: Record<string, number> = {
  Vodafone: 1,
  YesBank: 2,
  Cred: 3,
  TCS: 4,
  Reliance: 5,
  Infosys: 6,
}
