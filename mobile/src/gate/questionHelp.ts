// UI explanations of the existing sourced questions, not additional clinical rules.
// Draft, awaiting clinician review. Sources are displayed from the question bank.
export const questionHelp: Record<string, string> = {
  injury: 'Confirm whether this pain began after an accident or injury, such as a fall or impact. If you selected injury earlier by mistake and meant a gradual ache with activity, you can correct that here. A confirmed injury still needs assessment.',
  sudden: 'Did this pain begin suddenly, or did it build up gradually? Use No for a gradual onset. This follow-up can correct an earlier onset selection.',
  unable: 'This asks whether you cannot move the arm, not whether one particular movement is uncomfortable or difficult. Do not try a painful movement to answer.',
  numb: 'This asks about loss of feeling. Weakness or tiredness during a movement is not the same answer. Do not perform a test to check sensation.',
  tingling: 'This asks about pins and needles that persist or do not go away, rather than a brief sensation that has fully settled.',
  severe: 'This asks whether the pain is very severe, not simply whether pain is present. A pain score is context and does not cancel other warning symptoms.',
};
