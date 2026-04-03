import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import type { Card, Company } from '../../types/game'

interface Props {
  card: Card
  companies: Company[]
  onUse: (card: Card, companyNum?: number) => void
  onCancel: () => void
}

export default function PowerCardPanel({ card, companies, onUse, onCancel }: Props) {
  const name = card.company.replace(' ', '')

  if (name === 'LoanStock') {
    return (
      <div className="px-4 py-3 bg-amber-900/20 border-b border-amber-800/30 flex items-center gap-3">
        <span className="text-amber-400 text-sm font-medium">Loan Stock: +$100 cash</span>
        <button
          onClick={() => onUse(card)}
          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg"
        >
          Use
        </button>
        <button onClick={onCancel} className="text-gray-400 text-sm hover:text-white">Cancel</button>
      </div>
    )
  }

  if (name === 'Debenture') {
    const closedCompanies = companies.filter((c) => !c.is_open)
    return (
      <div className="px-4 py-3 bg-amber-900/20 border-b border-amber-800/30 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm font-medium">Debenture: Reopen a closed company</span>
          <button onClick={onCancel} className="text-gray-400 text-sm hover:text-white ml-auto">Cancel</button>
        </div>
        {closedCompanies.length === 0 ? (
          <p className="text-gray-500 text-xs">No companies are closed</p>
        ) : (
          <div className="flex gap-2">
            {closedCompanies.map((co) => (
              <button
                key={co.name}
                onClick={() => onUse(card, companies.indexOf(co) + 1)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
              >
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', COMPANY_COLOR[co.name])} />
                {co.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (name === 'RightsIssue') {
    const openCompanies = companies.filter((c) => c.is_open)
    return (
      <div className="px-4 py-3 bg-amber-900/20 border-b border-amber-800/30 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm font-medium">Rights Issue: Select a company</span>
          <button onClick={onCancel} className="text-gray-400 text-sm hover:text-white ml-auto">Cancel</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {openCompanies.map((co) => (
            <button
              key={co.name}
              onClick={() => onUse(card, companies.indexOf(co) + 1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg border border-gray-600"
            >
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', COMPANY_COLOR[co.name])} />
              {co.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return null
}
