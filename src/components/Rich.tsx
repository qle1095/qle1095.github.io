// Renders story strings from journey.ts, where **text** marks a keyword
// highlight for skimmability.
export default function Rich({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="hl">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
