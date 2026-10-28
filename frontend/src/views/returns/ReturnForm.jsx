import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CFormCheck,
} from '@coreui/react'
import { reintegrates, validateReturn } from './returnModel'
import { ReturnFinancialNotice } from './ReturnDetail'

const ReturnForm = ({ context, busy, onSave }) => {
  const [values, setValues] = useState({
    id_venta: context.sale.id_venta,
    numero_devolucion: '',
    motivo: '',
    observacion: '',
    detalles: [],
  })
  const [detailId, setDetailId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitId, setUnitId] = useState('')
  const [condition, setCondition] = useState('APTO')
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const line = context.lines.find((d) => String(d.id_detalle_venta) === detailId)
  const clearReview = () => {
    setReview(false)
    setChecked(false)
    setError('')
  }
  const change = (e) => {
    clearReview()
    setValues({ ...values, [e.target.name]: e.target.value })
  }
  const remaining = (d) =>
    d.remaining -
    values.detalles
      .filter((r) => Number(r.id_detalle_venta) === Number(d.id_detalle_venta))
      .reduce((n, r) => n + Number(r.cantidad), 0)
  const labelUnit = (u) =>
    `IMEI 1: ${u.imei1 || '—'} · IMEI 2: ${u.imei2 || '—'} · Serie: ${u.numero_serie || '—'}`
  return (
    <CForm
      onSubmit={(e) => {
        e.preventDefault()
        if (busy) return
        try {
          if (detailId)
            throw new Error('Agrega el artículo en edición o limpia su selección antes de revisar.')
          validateReturn(values, context)
          if (!review) {
            setReview(true)
            setChecked(false)
            setError('')
            return
          }
          if (checked) {
            setChecked(false)
            onSave(values)
          }
        } catch (err) {
          setError(err.message)
          setReview(false)
          setChecked(false)
        }
      }}
    >
      {error && <CAlert color="danger">{error}</CAlert>}
      {context.serialError && <CAlert color="warning">{context.serialError}</CAlert>}
      <fieldset disabled={busy}>
        <p>
          <strong>{context.sale.numero_venta}</strong> · {context.sale.cliente} ·{' '}
          {context.sale.sucursal} · {context.sale.tipo_venta}
        </p>
        <ReturnFinancialNotice />
        <h3 className="h6">Artículos vendidos</h3>
        <ul>
          {context.lines.map((d) => (
            <li key={d.id_detalle_venta}>
              {d.producto} · {d.sku} · {d.tipo_control} · Vendidos: {d.cantidad} · Devueltos
              confirmados: {d.returned} · Pendientes: {d.remaining}
            </li>
          ))}
        </ul>
        <CFormInput
          id="return-number"
          className="mb-3"
          label="Número de devolución"
          name="numero_devolucion"
          maxLength={50}
          value={values.numero_devolucion}
          onChange={change}
          required
        />
        <CFormTextarea
          id="return-reason"
          className="mb-3"
          label="Motivo de la devolución"
          name="motivo"
          maxLength={500}
          value={values.motivo}
          onChange={change}
          required
        />
        <CFormTextarea
          id="return-observation"
          className="mb-3"
          label="Observación (opcional)"
          name="observacion"
          maxLength={500}
          value={values.observacion}
          onChange={change}
        />
        <CFormSelect
          id="return-sale-line"
          className="mb-3"
          label="Artículo vendido a devolver"
          value={detailId}
          onChange={(e) => {
            setDetailId(e.target.value)
            setUnitId('')
            setQuantity('1')
            clearReview()
          }}
        >
          <option value="">Selecciona un artículo</option>
          {context.lines.map((d) => (
            <option
              key={d.id_detalle_venta}
              value={d.id_detalle_venta}
              disabled={remaining(d) <= 0 || (d.tipo_control === 'SERIALIZADO' && !d.units.length)}
            >
              {d.producto} · Pendientes para agregar: {remaining(d)}
              {d.tipo_control === 'SERIALIZADO' && !d.units.length
                ? ' · Sin IMEI verificables pendientes'
                : ''}
            </option>
          ))}
        </CFormSelect>
        {line && (
          <div className="border rounded p-3 mb-3">
            {line.tipo_control === 'CANTIDAD' ? (
              <CFormInput
                id="return-quantity"
                label="Cantidad a devolver"
                type="number"
                min="1"
                max={remaining(line)}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            ) : (
              <CFormSelect
                id="return-unit"
                label="IMEI exacto vendido (una unidad por línea)"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">Selecciona dispositivo</option>
                {line.units
                  .filter(
                    (u) =>
                      !values.detalles.some((r) => Number(r.id_unidad) === Number(u.id_unidad)),
                  )
                  .map((u) => (
                    <option key={u.id_unidad} value={u.id_unidad}>
                      {labelUnit(u)}
                    </option>
                  ))}
              </CFormSelect>
            )}
            <CFormSelect
              id="return-condition"
              className="my-3"
              label="Condición recibida"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              <option value="APTO">APTO (buen estado)</option>
              <option value="DEFECTUOSO">DEFECTUOSO (falla técnica / dañado)</option>
            </CFormSelect>
            {line.tipo_control === 'CANTIDAD' && condition === 'APTO' && (
              <CFormCheck
                id="return-restock"
                label="Reintegrar estas unidades aptas al inventario al confirmar"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
              />
            )}
            <p>
              {condition === 'DEFECTUOSO'
                ? 'No suma stock disponible. Un teléfono quedará DEFECTUOSO al confirmar.'
                : line.tipo_control === 'SERIALIZADO'
                  ? 'Al confirmar, el teléfono quedará DISPONIBLE y sumará una unidad al stock.'
                  : 'El reintegro se aplicará según la casilla seleccionada.'}
            </p>
            <CFormTextarea
              id="return-line-reason"
              label="Motivo de este artículo (opcional)"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <CButton
              type="button"
              color="secondary"
              className="mt-3"
              onClick={() => {
                const d = {
                  id_detalle_venta: Number(detailId),
                  cantidad: line.tipo_control === 'SERIALIZADO' ? 1 : Number(quantity),
                  id_unidad: line.tipo_control === 'SERIALIZADO' ? Number(unitId) : null,
                  condicion: condition,
                  reintegra_inventario: reintegrates(line.tipo_control, condition, restock),
                  motivo: reason,
                }
                const next = { ...values, detalles: [...values.detalles, d] }
                try {
                  validateReturn(next, context)
                  setValues(next)
                  setDetailId('')
                  setUnitId('')
                  setReason('')
                  clearReview()
                } catch (err) {
                  setError(err.message)
                }
              }}
            >
              Agregar artículo
            </CButton>
          </div>
        )}
        <h3 className="h6">Artículos de esta devolución</h3>
        {!values.detalles.length && <p>No hay artículos agregados.</p>}
        <ul>
          {values.detalles.map((d, i) => {
            const sold = context.lines.find(
              (s) => Number(s.id_detalle_venta) === d.id_detalle_venta,
            )
            const unit = sold.units.find((u) => Number(u.id_unidad) === d.id_unidad)
            return (
              <li key={i} className="mb-3">
                {sold.producto} · Cantidad: {d.cantidad} · {d.condicion} · Reintegra:{' '}
                {d.reintegra_inventario ? 'Sí' : 'No'}
                {unit && <div>{labelUnit(unit)}</div>}
                {d.motivo && <div>Motivo: {d.motivo}</div>}
                <CButton
                  type="button"
                  color="danger"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setValues({ ...values, detalles: values.detalles.filter((_, n) => n !== i) })
                    clearReview()
                  }}
                >
                  Quitar
                </CButton>
              </li>
            )
          })}
        </ul>
        {review && (
          <CAlert color="info">
            <strong>Resumen: {values.numero_devolucion}</strong>
            <p>
              Venta {context.sale.numero_venta} ·{' '}
              {values.detalles.reduce((n, d) => n + Number(d.cantidad), 0)} unidades · Motivo:{' '}
              {values.motivo}
            </p>
            <p>
              Crear guarda BORRADOR sin modificar inventario. Revisa arriba artículos, IMEI,
              condición y reintegro.
            </p>
            <CFormCheck
              id="return-create-confirm"
              label="Revisé los datos y confirmo registrar este borrador"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
          </CAlert>
        )}
        <CButton color="primary" type="submit" disabled={busy || (review && !checked)}>
          {busy ? 'Procesando…' : review ? 'Crear borrador' : 'Revisar devolución'}
        </CButton>
      </fieldset>
    </CForm>
  )
}
ReturnForm.propTypes = {
  context: PropTypes.object.isRequired,
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}
export default ReturnForm
