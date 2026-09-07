import { useState } from "react";

export default function RecordForm({ fields, initialValues, onSave, onCancel, title }) {
  const [values, setValues] = useState(initialValues || {});

  const handleChange = (name, val) => setValues((v) => ({ ...v, [name]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={handleSubmit}>
        <h3 className="modal-title">{title}</h3>
        {fields.map((f) => (
          <div className="field-group" key={f.name}>
            <label className="field-label">{f.label}</label>
            <input
              className="field-input"
              type={
                f.type === "date"
                  ? "date"
                  : f.type === "currency" || f.type === "double"
                  ? "number"
                  : "text"
              }
              value={values[f.name] ?? ""}
              disabled={!f.createable && !f.updateable}
              onChange={(e) => handleChange(f.name, e.target.value)}
            />
          </div>
        ))}
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}