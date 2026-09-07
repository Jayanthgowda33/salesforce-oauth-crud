const OBJECTS = ["Account", "Opportunity", "Lead", "Contact", "Case"];

export default function ObjectSelector({ value, onChange }) {
  return (
    <div className="select-wrap">
      <select
        className="object-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">select object</option>
        {OBJECTS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}