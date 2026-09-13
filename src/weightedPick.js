export function weightedPick(pool, weights, groupId, random = Math.random) {
  if (!pool.length) return undefined
  const configured = (person) => {
    const value = Number(weights?.[`${groupId}-${person.name}`] ?? weights?.[`0-${person.name}`])
    return Number.isFinite(value) && value > 0 ? value : 0
  }
  const configuredTotal = pool.reduce((sum, person) => sum + configured(person), 0)
  const forced = pool.filter((person) => configured(person) >= 100)
  const candidates = forced.length ? forced : pool
  const probability = (person) => {
    const value = configured(person)
    if (configuredTotal >= 100) return value
    const unconfigured = candidates.filter((candidate) => configured(candidate) === 0).length
    return value || (unconfigured ? (100 - configuredTotal) / unconfigured : 0)
  }
  const total = candidates.reduce((sum, person) => sum + probability(person), 0)
  let target = random() * total
  return candidates.find((person) => {
    target -= probability(person)
    return target < 0
  }) || candidates[candidates.length - 1]
}
