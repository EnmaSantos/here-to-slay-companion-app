export function describeRoll(requirement) {
  const match = /^(\d+)([+-])$/.exec(requirement ?? "");
  return match
    ? `${match[1]} or ${match[2] === "+" ? "higher" : "lower"}`
    : (requirement ?? "Not available");
}

export function neutralRollRange(slay, penalty) {
  const success = /^(\d+)([+-])$/.exec(slay ?? "");
  const failure = /^(\d+)([+-])$/.exec(penalty ?? "");
  if (!success || !failure || success[2] === failure[2]) return null;
  const low = Number(success[2] === "-" ? success[1] : failure[1]) + 1;
  const high = Number(success[2] === "+" ? success[1] : failure[1]) - 1;
  return low <= high ? (low === high ? String(low) : `${low}–${high}`) : null;
}
