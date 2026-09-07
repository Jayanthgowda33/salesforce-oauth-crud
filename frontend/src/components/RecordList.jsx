import { useEffect, useRef, useState, useCallback } from "react";
import { getFields, getRecords, createRecord, updateRecord, deleteRecord } from "../api";
import RecordForm from "./RecordForm";

export default function RecordList({ objectName }) {
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setFields([]);
    setRecords([]);
    setOffset(0);
    setHasMore(true);
    if (!objectName) return;

    getFields(objectName).then(setFields);
    loadPage(objectName, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectName]);

  const loadPage = async (obj, off, replace = false) => {
    setLoading(true);
    try {
      const data = await getRecords(obj, off);
      setRecords((prev) => (replace ? data.records : [...prev, ...data.records]));
      setHasMore(data.hasMore);
      setOffset(data.nextOffset);
    } finally {
      setLoading(false);
    }
  };

  const observer = useRef(null);
  const sentinelCallback = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && objectName) {
          loadPage(objectName, offset);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, objectName, offset]
  );

  const handleSave = async (values) => {
    const payload = { ...values };
    delete payload.Id;
    if (editing?.Id) {
      await updateRecord(objectName, editing.Id, payload);
      setRecords((rs) => rs.map((r) => (r.Id === editing.Id ? { ...r, ...payload } : r)));
    } else {
      const created = await createRecord(objectName, payload);
      setRecords((rs) => [{ Id: created.id, ...payload }, ...rs]);
    }
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this record?")) return;
    await deleteRecord(objectName, id);
    setRecords((rs) => rs.filter((r) => r.Id !== id));
  };

  if (fields.length === 0) return <div className="status-line"><span className="spinner" /> loading fields...</div>;

  return (
    <div>
      <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setEditing({})}>
        + New {objectName}
      </button>

      <div className="table-wrap">
        <table className="records">
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.Id} style={{ animationDelay: `${Math.min(i, 20) * 0.02}s` }}>
                {fields.map((f) => (
                  <td key={f.name}>{String(r[f.name] ?? "")}</td>
                ))}
                <td>
                  <div className="row-actions">
                    <button onClick={() => setEditing(r)}>edit</button>
                    <button className="delete" onClick={() => handleDelete(r.Id)}>
                      delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div ref={sentinelCallback} style={{ height: 1 }} />
        {loading && (
          <div className="status-line">
            <span className="spinner" /> loading more records...
          </div>
        )}
        {!hasMore && records.length > 0 && (
          <div className="status-line">— end of records —</div>
        )}
        {records.length === 0 && !loading && (
          <div className="status-line">no records found</div>
        )}
      </div>

      {editing && (
        <RecordForm
          title={editing.Id ? `Edit ${objectName}` : `New ${objectName}`}
          fields={fields}
          initialValues={editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}