// Content rules that check-content reports but the loader does not enforce, because they follow
// from how editors use the CMS. They report problems and never change a file.

/**
 * Engagements show their stage number ("01", "02", …) in list order. Dragging entries in the CMS
 * renumbers `order` but not the stage numbers, so each engagement's stageNo must be its position.
 * `engagements` is the ENGAGEMENTS export, already in list order.
 */
export function stageNumberProblems(engagements) {
  return engagements.flatMap(({ name, stageNo }, index) => {
    const expected = String(index + 1).padStart(2, "0");
    return stageNo === expected ? [] : [`content/engagements: "${name}" is number ${index + 1} in the list but its stage number is ${JSON.stringify(stageNo)}; keep stage numbers in list order (01, 02, 03…): set it to "${expected}"`];
  });
}
