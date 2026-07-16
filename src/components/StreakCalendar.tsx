interface DayState {
  day: number
  title: string
  watched: boolean
  isToday: boolean
  isFuture: boolean
  isMissed: boolean
}

export default function StreakCalendar({ days }: { days: DayState[] }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d) => (
        <div
          key={d.day}
          title={`Day ${d.day}: ${d.title}`}
          className={[
            'aspect-square rounded-md flex items-center justify-center text-[11px] font-medium border',
            d.watched
              ? 'bg-emerald-500 text-white border-emerald-500'
              : d.isMissed
              ? 'bg-red-100 text-red-500 border-red-200'
              : d.isToday
              ? 'bg-brand-100 text-brand-700 border-brand-500'
              : d.isFuture
              ? 'bg-slate-50 text-slate-300 border-slate-100'
              : 'bg-white text-slate-400 border-slate-200',
          ].join(' ')}
        >
          {d.day}
        </div>
      ))}
    </div>
  )
}

export type { DayState }
