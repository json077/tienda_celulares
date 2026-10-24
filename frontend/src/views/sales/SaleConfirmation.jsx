import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CFormCheck, CFormLabel, CFormSelect } from '@coreui/react'
import SaleSummary from './SaleSummary'
import { availableUnits, unitLabel, validateLines } from './saleModel'

const SaleConfirmation = ({ sale, stock, units, saving, onConfirm, onCancel }) => {
  const [selected, setSelected] = useState({})
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState('')
  const lines = sale.detalles.map((l) => ({ ...l, selected: selected[l.id_detalle_venta] || [] }))
  const summary = {
    ...sale,
    detalles: lines.map((l) => ({
      ...l,
      unidades: units.filter((u) => l.selected.includes(String(u.id_unidad))),
    })),
  }
  const submit = () => {
    try {
      validateLines({ ...sale, detalles: lines }, stock, units, true)
      if (!reviewed) throw new Error('Confirma que revisaste la venta.')
      setError('')
      onConfirm(
        lines.flatMap((l) =>
          l.selected.map((id) => ({ id_detalle_venta: l.id_detalle_venta, id_unidad: id })),
        ),
      )
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <>
      <CAlert color="warning">
        Confirmar descontará existencias, marcará las unidades como VENDIDO y emitirá la factura en
        una transacción. El backend volverá a validar el stock. No registra pagos.
      </CAlert>
      {error && <CAlert color="danger">{error}</CAlert>}
      {lines
        .filter((l) => l.tipo_control === 'SERIALIZADO')
        .map((l) => (
          <div className="mb-3" key={l.id_detalle_venta}>
            <CFormLabel htmlFor={`confirm-unit-${l.id_detalle_venta}`}>
              {l.producto}: selecciona exactamente {l.cantidad} unidad(es) DISPONIBLE
            </CFormLabel>
            <CFormSelect
              id={`confirm-unit-${l.id_detalle_venta}`}
              multiple
              disabled={saving}
              value={l.selected}
              onChange={(e) => {
                setSelected({
                  ...selected,
                  [l.id_detalle_venta]: Array.from(e.target.selectedOptions, (o) => o.value),
                })
                setReviewed(false)
              }}
            >
              {availableUnits(units, sale.id_sucursal, l.id_producto).map((u) => (
                <option
                  key={u.id_unidad}
                  value={u.id_unidad}
                  disabled={lines.some(
                    (other) =>
                      other.id_detalle_venta !== l.id_detalle_venta &&
                      other.selected.includes(String(u.id_unidad)),
                  )}
                >
                  {unitLabel(u)}
                </option>
              ))}
            </CFormSelect>
          </div>
        ))}
      <SaleSummary sale={summary} />
      <CFormCheck
        id="sale-confirm-reviewed"
        disabled={saving}
        checked={reviewed}
        onChange={(e) => setReviewed(e.target.checked)}
        label="He revisado cliente, sucursal, productos, IMEI e importes y autorizo confirmar la venta"
      />
      <CButton className="mt-3 me-2" color="secondary" disabled={saving} onClick={onCancel}>
        Volver
      </CButton>
      <CButton className="mt-3" color="primary" disabled={saving || !reviewed} onClick={submit}>
        Confirmar venta y emitir factura
      </CButton>
    </>
  )
}
SaleConfirmation.propTypes = {
  sale: PropTypes.object.isRequired,
  stock: PropTypes.array.isRequired,
  units: PropTypes.array.isRequired,
  saving: PropTypes.bool.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}
export default SaleConfirmation
