export function weightedPick(pool, weights, groupId, random = Math.random) {
  const probability = (person) => Number(weights[`${groupId}-${person.name}`] ?? weights[`0-${person.name}`] ?? 0)
  const forced = pool.filter((person) => probability(person) >= 100)
  const candidates = forced.length ? forced : pool
  const total = candidates.reduce((sum, person) => sum + (probability(person) || 1), 0)
  let target = random() * total
  return candidates.find((person) => {
    target -= probability(person) || 1
    return target < 0
  }) || candidates[candidates.length - 1]
}
