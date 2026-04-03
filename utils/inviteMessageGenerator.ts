import { AgentRenter } from '../services/agentMatchmakerService';

interface ListingInfo {
  title?: string;
  price?: number;
  bedrooms?: number;
  neighborhood?: string;
}

function formatNameList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + `, and ${items[items.length - 1]}`;
}

function getTopCompatibilityFactors(target: AgentRenter, others: AgentRenter[]): string[] {
  const highlights: string[] = [];

  const allSleep = [target.sleepSchedule, ...others.map(o => o.sleepSchedule)].filter(Boolean);
  if (allSleep.length > 1) {
    if (allSleep.every(s => s === 'early')) {
      highlights.push("You're all early risers \u2014 no 3am noise conflicts");
    } else if (allSleep.every(s => s === 'late')) {
      highlights.push("You all keep similar late-night schedules");
    } else if (allSleep.every(s => s === target.sleepSchedule || s === 'flexible')) {
      highlights.push("Compatible sleep schedules \u2014 everyone's flexible or aligned");
    }
  }

  const cleanScores = [target.cleanliness, ...others.map(o => o.cleanliness)].filter(n => n != null) as number[];
  if (cleanScores.length > 1) {
    const cleanRange = Math.max(...cleanScores) - Math.min(...cleanScores);
    if (cleanRange <= 1) {
      highlights.push(`Similar cleanliness standards (${Math.min(...cleanScores)}-${Math.max(...cleanScores)}/10)`);
    } else if (cleanRange <= 2) {
      highlights.push("Close cleanliness levels \u2014 within 2 points of each other");
    }
  }

  const smokingVals = [target.smoking, ...others.map(o => o.smoking)];
  if (smokingVals.every(s => s === 'no' || s === false || s === 'non-smoker')) {
    highlights.push("All non-smokers");
  }

  const hasPets = [target, ...others].some(r => r.pets || r.hasPets);
  const hasAllergy = [target, ...others].some(r => r.noPetsAllergy === false);
  if (!hasPets && !hasAllergy) {
    highlights.push("No pet conflicts");
  } else if (hasPets && !hasAllergy) {
    highlights.push("Pet-friendly group \u2014 no allergies");
  }

  const noiseScores = [target.noiseTolerance, ...others.map(o => o.noiseTolerance)].filter(n => n != null) as number[];
  if (noiseScores.length > 1) {
    const noiseRange = Math.max(...noiseScores) - Math.min(...noiseScores);
    if (noiseRange <= 1) {
      highlights.push("Similar noise tolerance levels");
    }
  }

  const allBudgets = [target, ...others];
  const mins = allBudgets.map(r => r.budgetMin ?? 0).filter(v => v > 0);
  const maxes = allBudgets.map(r => r.budgetMax ?? 0).filter(v => v > 0);
  if (mins.length > 0 && maxes.length > 0) {
    highlights.push(`Combined budget range: $${Math.min(...mins).toLocaleString()}-$${Math.max(...maxes).toLocaleString()}/mo`);
  }

  const guestPolicies = [target.guestPolicy, ...others.map(o => o.guestPolicy)].filter(Boolean);
  if (guestPolicies.length > 1 && guestPolicies.every(g => g === guestPolicies[0])) {
    highlights.push(`Aligned on guest policy (${guestPolicies[0]})`);
  }

  const workStyles = [target.workLocation, ...others.map(o => o.workLocation)].filter(Boolean);
  if (workStyles.length > 1) {
    if (workStyles.every(w => w === 'remote')) {
      highlights.push("All remote workers \u2014 you'll share the space comfortably");
    } else if (workStyles.every(w => w === 'office')) {
      highlights.push("All office-based \u2014 apartment will be quiet during the day");
    }
  }

  return highlights;
}

function getSharedInterests(target: AgentRenter, others: AgentRenter[]): string[] {
  if (!target.interests?.length) return [];
  const otherInterests = others.flatMap(o => o.interests || []);
  return target.interests.filter(i => otherInterests.includes(i));
}

export function generateInviteMessage(
  targetRenter: AgentRenter,
  otherMembers: AgentRenter[],
  listing: ListingInfo | null | undefined,
  agentName: string
): string {
  const otherNames = otherMembers.map(m => m.name.split(' ')[0]);
  const namesStr = formatNameList(otherNames);

  const highlights = getTopCompatibilityFactors(targetRenter, otherMembers);
  const sharedInterests = getSharedInterests(targetRenter, otherMembers);

  let msg = `Hi ${targetRenter.name.split(' ')[0]}!\n\n`;
  msg += `I'm ${agentName}, and I think I've found a great roommate match for you. `;

  if (otherMembers.length === 1) {
    const other = otherMembers[0];
    msg += `I'd like to introduce you to ${other.name.split(' ')[0]}, ${other.age}`;
    if (other.occupation) msg += `, a ${other.occupation.toLowerCase()}`;
    if (other.neighborhood) msg += ` from ${other.neighborhood}`;
    msg += `.\n\n`;
  } else {
    msg += `I'd like to introduce you to ${namesStr} \u2014 `;
    msg += otherMembers.map(m => {
      let desc = `${m.name.split(' ')[0]} (${m.age}`;
      if (m.occupation) desc += `, ${m.occupation.toLowerCase()}`;
      desc += ')';
      return desc;
    }).join(', ') + `.\n\n`;
  }

  if (highlights.length > 0) {
    msg += `Here's why I think you'd be a great fit together:\n`;
    for (const h of highlights.slice(0, 4)) {
      msg += `\u2022 ${h}\n`;
    }
    msg += `\n`;
  }

  if (sharedInterests.length > 0) {
    msg += `You also share some interests \u2014 you're all into ${formatNameList(sharedInterests)}.\n\n`;
  }

  if (listing && listing.title && listing.price) {
    msg += `I have a ${listing.title} available at $${listing.price.toLocaleString()}/mo that would work well for your combined budget.\n\n`;
  }

  msg += `Let me know if you're interested and I can set up a group chat so you can all connect!`;

  return msg;
}

export function generateAllInviteMessages(
  members: AgentRenter[],
  listing: ListingInfo | null | undefined,
  agentName: string
): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const member of members) {
    const others = members.filter(m => m.id !== member.id);
    messages[member.id] = generateInviteMessage(member, others, listing, agentName);
  }
  return messages;
}
