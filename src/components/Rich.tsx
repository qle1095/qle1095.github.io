// Renders story strings from journey.ts and playground.ts. Two levels of
// emphasis for skimmability:
//   **text**  the headline outcome: bold on a soft band (one per story)
//   [[text]]  a keyword a recruiter scans for (tech, numbers, scope): bold only
const TOKEN = /(\*\*.+?\*\*|\[\[.+?\]\])/g;

export default function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="hl">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('[[') && part.endsWith(']]')) {
          return (
            <strong key={i} className="kw">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </>
  );
}
