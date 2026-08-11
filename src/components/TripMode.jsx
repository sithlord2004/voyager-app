import { useMemo } from 'react'
import { findActiveTrip, tripDays, nextFlight, currentStay, dayLabel, isoDate } from '../lib/tripMode.js'
import DayPlans from './DayPlans.jsx'

// While you're away, the app leads with today rather than with planning.
// Deliberately useful with no input at all: day X of Y, the weather, where
// you're staying and what's next are all derived from the trip itself.
export default function TripMode({ trips = [], refreshKey, wx, sun }) {
  const trip = useMemo(() => findActiveTrip(trips), [trips, refreshKey])
  const days = trip ? tripDays(trip) : null
  if (!trip || !days) return null

  const stay = currentStay(trip)
  const flight = nextFlight(trip)
  const today = isoDate()
  const checkoutToday = stay?.checkOut === today
  const flightToday = flight?.date === today

  return (
    <div className="card tm">
      <div className="tm-head">
        <div>
          <span className="tm-kicker">Trip in progress</span>
          <h3 style={{ margin: '2px 0 0' }}>
            Day {days.dayNumber} of {days.total} in {trip.destinationCity || 'your trip'}
          </h3>
        </div>
        {wx?.temp != null && <span className="tm-temp">{wx.icon} {Math.round(wx.temp)}°</span>}
      </div>

      <div className="tm-facts">
        {sun?.sunset && <span className="tm-fact">Sunset {sun.sunset}</span>}
        {stay && (
          <span className="tm-fact">
            {stay.name}{stay.checkOut ? ` · out ${dayLabel(stay.checkOut)}` : ''}
          </span>
        )}
        {flight && (
          <span className={'tm-fact' + (flightToday ? ' urgent' : '')}>
            {flight.number} {flight.route} · {dayLabel(flight.date)}
          </span>
        )}
      </div>

      {(checkoutToday || flightToday) && (
        <div className="tm-alert">
          {flightToday ? 'Flying today — see your leave-by time above.' : 'Checking out today.'}
        </div>
      )}

      <DayPlans trip={trip} />
    </div>
  )
}
