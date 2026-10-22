import React from 'react'
import PropTypes from 'prop-types'
import {
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

const InventoryTable = ({ columns, rows, rowKey, emptyMessage }) => (
  <CTable responsive hover align="middle" className="mb-0">
    <CTableHead>
      <CTableRow>
        {columns.map(({ key, label }) => (
          <CTableHeaderCell key={key} scope="col">
            {label}
          </CTableHeaderCell>
        ))}
      </CTableRow>
    </CTableHead>
    <CTableBody>
      {rows.map((row) => (
        <CTableRow key={rowKey(row)}>
          {columns.map(({ key, render }) => (
            <CTableDataCell key={key}>{render ? render(row) : (row[key] ?? '—')}</CTableDataCell>
          ))}
        </CTableRow>
      ))}
      {!rows.length && (
        <CTableRow>
          <CTableDataCell colSpan={columns.length} className="text-center py-4">
            {emptyMessage}
          </CTableDataCell>
        </CTableRow>
      )}
    </CTableBody>
  </CTable>
)

InventoryTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      render: PropTypes.func,
    }),
  ).isRequired,
  rows: PropTypes.array.isRequired,
  rowKey: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string.isRequired,
}

export default InventoryTable
