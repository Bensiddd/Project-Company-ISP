import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HiSearch, HiChevronUp, HiChevronDown, HiTrash, HiPencil, HiChevronLeft, HiChevronRight } from 'react-icons/hi';

const DataTable = ({ columns, data, searchKeys = [], onEdit, onDelete, onToggleStatus, loading = false, title, addButton, pageSize = 10, statusKey = 'is_active' }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState(null);

  const isActive = (item) => {
    const val = item[statusKey];
    if (typeof val === 'string') return val === 'published' || val === 'active';
    return val == 1 || val == true;
  };

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(item =>
      searchKeys.some(key => {
        const val = key.split('.').reduce((o, k) => o?.[k], item);
        return val?.toString().toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]?.toString().toLowerCase() || '';
      const bVal = b[sortKey]?.toString().toLowerCase() || '';
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const handleDelete = (id) => {
    if (confirmId === id) { onDelete(id); setConfirmId(null); }
    else { setConfirmId(id); }
  };

  if (loading) {
    return (
      <div className="data-table-wrapper">
        <div className="data-table-header"><h1>{title}</h1></div>
        <div className="data-table-skeleton">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-row"><div className="skeleton-bar" style={{ width: `${60 + Math.random() * 40}%` }} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="data-table-wrapper" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="data-table-header">
        <div><h1>{title}</h1><span className="data-table-count">{sorted.length} entries</span></div>
        {addButton && (
          <button className="btn btn-primary" onClick={addButton.onClick}>+ {addButton.label}</button>
        )}
      </div>

      <div className="data-table-toolbar">
        <div className="data-table-search">
          <HiSearch />
          <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)} style={{ cursor: col.sortable !== false ? 'pointer' : 'default', width: col.width }}>
                  <span>{col.label}</span>
                  {sortKey === col.key && (sortDir === 'asc' ? <HiChevronUp /> : <HiChevronDown />)}
                </th>
              ))}
              {(onEdit || onDelete || onToggleStatus) && <th style={{ width: 140 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map(item => (
              <motion.tr key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(item) : col.key.split('.').reduce((o, k) => o?.[k], item) ?? '—'}
                  </td>
                ))}
                {(onEdit || onDelete || onToggleStatus) && (
                  <td>
                    <div className="data-table-actions">
                      {onToggleStatus && (
                        <button
                          className={`btn-toggle ${isActive(item) ? 'active' : 'inactive'}`}
                          onClick={() => onToggleStatus(item.id)}
                          title={isActive(item) ? 'Deactivate' : 'Activate'}
                        >
                          <div className="toggle-dot" />
                        </button>
                      )}
                      {onEdit && (
                        <button className="btn-icon" onClick={() => onEdit(item)} title="Edit"><HiPencil /></button>
                      )}
                      {onDelete && (
                        <button
                          className={`btn-icon ${confirmId === item.id ? 'btn-icon-danger-confirm' : 'btn-icon-danger'}`}
                          onClick={() => handleDelete(item.id)}
                          title={confirmId === item.id ? 'Confirm delete' : 'Delete'}
                        >
                          <HiTrash />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={columns.length + ((onEdit || onDelete || onToggleStatus) ? 1 : 0)}>
                <div className="data-table-empty">No data found</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="data-table-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><HiChevronLeft /></button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><HiChevronRight /></button>
        </div>
      )}
    </motion.div>
  );
};

export default DataTable;
