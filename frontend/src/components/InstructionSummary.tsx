import React from 'react'
import { AlertTriangle, Settings, Calendar, Target, Fuel } from 'lucide-react'
import { parseInstructions, getInstructionSummary, hasImportantInfo, type ParsedInstructions } from '../utils/instructionParser'
import { Badge } from '@/components/ui/badge'
import { InstructionBadge } from './InstructionBadge'
import { cn } from '@/lib/utils'

interface InstructionSummaryProps {
  instructions: string | null | undefined
  serviceCode?: string
  mode?: 'compact' | 'detailed' | 'badges' | 'compact-badges'
  className?: string
  maxLength?: number
}

export const InstructionSummary: React.FC<InstructionSummaryProps> = ({
  instructions,
  serviceCode,
  mode = 'compact',
  className,
  maxLength = 100
}) => {
  if (!instructions) return null

  const parsed = parseInstructions(instructions, serviceCode)
  const hasImportant = hasImportantInfo(instructions, serviceCode)

  if (!hasImportant && mode === 'compact') return null

  if (mode === 'compact') {
    const summary = getInstructionSummary(instructions, serviceCode, maxLength)
    if (!summary) return null

    return (
      <div className={cn(
        "flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800",
        className
      )}>
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{summary}</span>
      </div>
    )
  }

  if (mode === 'compact-badges') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="uppercase tracking-wide">Key Info:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <InstructionBadges parsed={parsed} compact={true} />
        </div>
      </div>
    )
  }

  if (mode === 'badges') {
    return (
      <div className={cn(
        "bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-zinc-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm",
        className
      )}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Key Instructions
            </h4>
            <div className="flex flex-wrap gap-3">
              <InstructionBadges parsed={parsed} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Detailed mode
  return (
    <div className={cn(
      "space-y-2 text-sm bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800",
      className
    )}>
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
        <AlertTriangle className="w-4 h-4" />
        <span>Instructions Summary</span>
      </div>
      
      <div className="space-y-2">
        {/* Key Info */}
        {parsed.keyInfo.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parsed.keyInfo.map((info, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {info}
              </Badge>
            ))}
          </div>
        )}

        {/* Detailed breakdown */}
        <InstructionDetails parsed={parsed} />
      </div>
    </div>
  )
}

interface InstructionBadgesProps {
  parsed: ParsedInstructions
  compact?: boolean
}

const InstructionBadges: React.FC<InstructionBadgesProps> = ({ parsed, compact = false }) => {
  const badges = []

  // If compact mode, use smaller badge component
  const BadgeComponent = compact ? Badge : InstructionBadge

  // Special job type badges
  if (parsed.specialJobType) {
    switch (parsed.specialJobType) {
      case 'new_store':
        badges.push(
          compact ? (
            <Badge key="new-store" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 text-xs">
              🆕 New Store
            </Badge>
          ) : (
            <InstructionBadge key="new-store" variant="new-store">
              <span className="text-lg">🆕</span>
              <span>New Store</span>
            </InstructionBadge>
          )
        )
        break
      case 'remodeled':
        badges.push(
          compact ? (
            <Badge key="remodeled" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 text-xs">
              🔄 Remodeled
            </Badge>
          ) : (
            <InstructionBadge key="remodeled" variant="remodeled">
              <span className="text-lg">🔄</span>
              <span>Remodeled</span>
            </InstructionBadge>
          )
        )
        break
      case 'circle_k_priority':
        badges.push(
          compact ? (
            <Badge key="priority" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 text-xs">
              🔥 Priority {parsed.priority}
            </Badge>
          ) : (
            <InstructionBadge key="priority" variant="priority">
              <span className="text-lg">🔥</span>
              <span>Priority {parsed.priority}</span>
            </InstructionBadge>
          )
        )
        break
      case 'multi_day':
        let dayText = 'Multi-Day'
        if (parsed.multiDayInfo.currentDay && parsed.multiDayInfo.totalDays) {
          dayText = `Day ${parsed.multiDayInfo.currentDay}/${parsed.multiDayInfo.totalDays}`
        } else if (parsed.multiDayInfo.isStartDay) {
          dayText = 'Start Day'
        } else if (parsed.multiDayInfo.isFinishDay) {
          dayText = 'Finish Day'
        }
        badges.push(
          compact ? (
            <Badge key="multi-day" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 text-xs">
              📅 {dayText}
            </Badge>
          ) : (
            <InstructionBadge key="multi-day" variant="multi-day">
              <span className="text-lg">📅</span>
              <span>{dayText}</span>
            </InstructionBadge>
          )
        )
        break
      case 'post_construction':
        badges.push(
          compact ? (
            <Badge key="post-construction" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 text-xs">
              🚧 Post Construction
            </Badge>
          ) : (
            <InstructionBadge key="post-construction" variant="post-construction">
              <span className="text-lg">🚧</span>
              <span>Post Construction</span>
            </InstructionBadge>
          )
        )
        break
    }
  }

  // Automation type badge (only if not standard) - MOVED BEFORE DISPENSERS
  if (parsed.automationType === 'specific_dispensers') {
    badges.push(
      compact ? (
        <Badge key="specific" className="bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 text-xs">
          🎯 Specific
        </Badge>
      ) : (
        <InstructionBadge key="specific" variant="specific">
          <span className="text-lg">🎯</span>
          <span>Specific</span>
        </InstructionBadge>
      )
    )
  } else if (parsed.automationType === 'open_neck_prover') {
    badges.push(
      compact ? (
        <Badge key="prover" className="bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300 px-2 py-0.5 text-xs">
          🔧 Open Neck Prover
        </Badge>
      ) : (
        <InstructionBadge key="prover" variant="prover">
          <span className="text-lg">🔧</span>
          <span>Open Neck Prover</span>
        </InstructionBadge>
      )
    )
  }

  // Dispenser count badge - MOVED AFTER SPECIFIC
  if (parsed.dispenserNumbers.length > 0) {
    const dispenserText = parsed.dispenserPairs.length > 0 
      ? `#${parsed.dispenserPairs.join(', #')}`
      : parsed.dispenserNumbers.length <= 3
        ? `#${parsed.dispenserNumbers.join(', #')}`
        : `${parsed.dispenserNumbers.length} Dispensers`
    
    badges.push(
      compact ? (
        <Badge key="dispensers" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 text-xs">
          {dispenserText}
        </Badge>
      ) : (
        <InstructionBadge key="dispensers" variant="dispensers">
          <Target className="w-5 h-5" />
          <span>{dispenserText}</span>
        </InstructionBadge>
      )
    )
  }

  // Special fuel grades
  const specialFuels = []
  if (parsed.fuelGrades.ethanol_free) specialFuels.push('Ethanol-Free')
  if (parsed.fuelGrades.race_fuel) specialFuels.push('Race Fuel')
  if (parsed.fuelGrades.special_88) specialFuels.push('Special 88')
  if (parsed.fuelGrades.extra_89) specialFuels.push('Extra 89')
  
  if (specialFuels.length > 0) {
    badges.push(
      compact ? (
        <Badge key="fuel" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 text-xs">
          ⛽ {specialFuels.join(', ')}
        </Badge>
      ) : (
        <InstructionBadge key="fuel" variant="fuel">
          <Fuel className="w-5 h-5" />
          <span>{specialFuels.join(', ')}</span>
        </InstructionBadge>
      )
    )
  }

  return <>{badges}</>
}

interface InstructionDetailsProps {
  parsed: ParsedInstructions
}

const InstructionDetails: React.FC<InstructionDetailsProps> = ({ parsed }) => {
  const details = []

  // Dispensers
  if (parsed.dispenserNumbers.length > 0) {
    details.push(
      <div key="dispensers" className="flex items-start gap-2">
        <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-blue-800 dark:text-blue-200">Dispensers</div>
          <div className="text-blue-700 dark:text-blue-300">
            {parsed.dispenserPairs.length > 0 ? (
              <>Pairs: #{parsed.dispenserPairs.join(', #')}</>
            ) : (
              <>#{parsed.dispenserNumbers.join(', #')}</>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Automation details
  if (parsed.automationType !== 'all_dispensers' || parsed.calibrationRequired) {
    details.push(
      <div key="automation" className="flex items-start gap-2">
        <Settings className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-gray-800 dark:text-gray-200">Automation</div>
          <div className="text-gray-700 dark:text-gray-300">
            {parsed.automationType === 'specific_dispensers' && 'Specific Dispensers Only'}
            {parsed.automationType === 'open_neck_prover' && 'Open Neck Prover'}
            {parsed.calibrationRequired && (
              <div>Calibration Required</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Multi-day info
  if (parsed.multiDayInfo.isMultiDay) {
    details.push(
      <div key="multiday" className="flex items-start gap-2">
        <Calendar className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-purple-800 dark:text-purple-200">Multi-Day Job</div>
          <div className="text-purple-700 dark:text-purple-300">
            {parsed.multiDayInfo.currentDay && parsed.multiDayInfo.totalDays && (
              <>Day {parsed.multiDayInfo.currentDay} of {parsed.multiDayInfo.totalDays}</>
            )}
            {parsed.multiDayInfo.isStartDay && <>Start Day</>}
            {parsed.multiDayInfo.isFinishDay && <>Finish Day</>}
          </div>
        </div>
      </div>
    )
  }

  // Fuel grades (only special ones)
  const specialFuels = []
  if (parsed.fuelGrades.ethanol_free) specialFuels.push('Ethanol-Free')
  if (parsed.fuelGrades.race_fuel) specialFuels.push('Race Fuel')
  if (parsed.fuelGrades.special_88) specialFuels.push('Special 88')
  if (parsed.fuelGrades.extra_89) specialFuels.push('Extra 89')
  
  if (specialFuels.length > 0) {
    details.push(
      <div key="fuel" className="flex items-start gap-2">
        <Fuel className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-green-800 dark:text-green-200">Special Fuels</div>
          <div className="text-green-700 dark:text-green-300">
            {specialFuels.join(', ')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {details}
    </div>
  )
}

export default InstructionSummary