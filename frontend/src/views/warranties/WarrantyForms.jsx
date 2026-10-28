import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
} from '@coreui/react'
import {
  claimTransitions,
  solutions,
  validateClaim,
  validateResolution,
  validateWarranty,
} from './warrantyModel'

const ConfirmedForm = ({ id, busy, validate, onSave, children, label }) => {
  const [checked, setChecked] = useState(false)
  let invalid = ''
  try {
    validate()
  } catch (e) {
    invalid = e.message
  }
  return (
    <CForm
      onChangeCapture={(e) => {
        if (e.target.name !== 'operation_confirmation') setChecked(false)
      }}
      onSubmit={(e) => {
        e.preventDefault()
        if (busy || !checked || invalid) return
        setChecked(false)
        onSave()
      }}
    >
      <fieldset disabled={busy}>
        {children}
        {invalid && <p role="status">{invalid}</p>}
        <CFormCheck
          id={`${id}-confirmation`}
          name="operation_confirmation"
          className="my-3"
          label="Revisé los datos y confirmo esta operación"
          checked={checked}
          disabled={busy || !!invalid}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <CButton type="submit" color="primary" disabled={busy || !checked || !!invalid}>
          {busy ? 'Procesando…' : label}
        </CButton>
      </fieldset>
    </CForm>
  )
}
ConfirmedForm.propTypes = {
  id: PropTypes.string.isRequired,
  busy: PropTypes.bool.isRequired,
  validate: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
}

export const WarrantyForm = ({ context, existing, busy, onSave }) => {
  const [detail, setDetail] = useState('')
  const [unit, setUnit] = useState('')
  const line = context.lines.find((d) => String(d.id_detalle_venta) === detail)
  const values = {
    id_venta: context.sale.id_venta,
    id_detalle_venta: detail,
    id_unidad: line?.tipo_control === 'SERIALIZADO' ? unit : null,
  }
  return (
    <ConfirmedForm
      id="warranty-create"
      busy={busy}
      label="Registrar garantía"
      validate={() => validateWarranty(values, context, existing)}
      onSave={() => onSave(values)}
    >
      <p>
        <strong>{context.sale.numero_venta}</strong> · {context.sale.cliente} ·{' '}
        {context.sale.sucursal}
      </p>
      {context.warning && <CAlert color="warning">{context.warning}</CAlert>}
      <CFormSelect
        id="warranty-sold-line"
        className="mb-3"
        label="Artículo vendido"
        value={detail}
        onChange={(e) => {
          setDetail(e.target.value)
          setUnit('')
        }}
      >
        <option value="">Selecciona artículo con cobertura histórica</option>
        {context.lines.map((d) => (
          <option
            key={d.id_detalle_venta}
            value={d.id_detalle_venta}
            disabled={!Number.isInteger(Number(d.dias_garantia)) || Number(d.dias_garantia) < 1}
          >
            {d.producto} · {d.sku} · {d.dias_garantia ?? 'Sin dato'} días · {d.tipo_control}
          </option>
        ))}
      </CFormSelect>
      {line?.tipo_control === 'SERIALIZADO' && (
        <>
          <CFormSelect
            id="warranty-unit"
            label="Dispositivo exacto de la factura"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Selecciona IMEI vendido</option>
            {line.units.map((u) => (
              <option key={u.id_unidad} value={u.id_unidad}>
                IMEI 1: {u.imei1 || '—'} · IMEI 2: {u.imei2 || '—'} · Serie: {u.numero_serie || '—'}
              </option>
            ))}
          </CFormSelect>
          {!line.units.length && (
            <p>
              No hay dispositivos históricos verificables. Se requiere la factura y
              FACTURA_IMPRIMIR.
            </p>
          )}
        </>
      )}
      {line && (
        <CAlert color="info" className="mt-3">
          {line.tipo_control === 'CANTIDAD'
            ? `La garantía cubre todo este detalle (${line.cantidad} unidades), sin identificar piezas individuales.`
            : 'Se registrará una garantía para el dispositivo seleccionado.'}{' '}
          El servidor usará la fecha de venta y {line.dias_garantia} días históricos. Puede
          registrarse ya VENCIDA; no se modifica el plazo.
        </CAlert>
      )}
    </ConfirmedForm>
  )
}
WarrantyForm.propTypes = {
  context: PropTypes.object.isRequired,
  existing: PropTypes.array.isRequired,
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export const ClaimForm = ({ warranty, claims, branches, defaultBranch = '', busy, onSave }) => {
  const [values, setValues] = useState({
    id_sucursal: String(defaultBranch),
    numero_reclamo: '',
    motivo: '',
    observacion: '',
  })
  const change = (e) => setValues({ ...values, [e.target.name]: e.target.value })
  return (
    <ConfirmedForm
      id="warranty-claim"
      busy={busy}
      label="Registrar reclamo"
      validate={() => validateClaim(values, warranty, claims)}
      onSave={() => onSave(values)}
    >
      <p>
        Garantía #{warranty.id_garantia}. El servidor comprobará cobertura y ausencia de otro
        reclamo abierto.
      </p>
      <CFormSelect
        id="claim-branch-select"
        className="mb-2"
        label="Sucursal de recepción conocida"
        name="id_sucursal"
        value={branches.some((b) => b.id === values.id_sucursal) ? values.id_sucursal : ''}
        onChange={change}
      >
        <option value="">Selecciona una sucursal</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </CFormSelect>
      <CFormInput
        id="claim-branch-id"
        className="mb-3"
        label="ID de sucursal existente (si no aparece)"
        name="id_sucursal"
        type="number"
        min="1"
        step="1"
        value={values.id_sucursal}
        onChange={change}
      />
      <p className="small text-body-secondary">
        No existe catálogo público de sucursales. Puede recibirse en cualquier sucursal activa; el
        servidor la valida.
      </p>
      <CFormInput
        id="claim-number"
        className="mb-3"
        label="Número de reclamo"
        name="numero_reclamo"
        value={values.numero_reclamo}
        onChange={change}
      />
      <CFormTextarea
        id="claim-reason"
        className="mb-3"
        label="Motivo"
        name="motivo"
        value={values.motivo}
        onChange={change}
      />
      <CFormTextarea
        id="claim-observation"
        className="mb-3"
        label="Observación (opcional)"
        name="observacion"
        value={values.observacion}
        onChange={change}
      />
      <p>Registrar deja el reclamo RECIBIDO. No cambia inventario, dispositivo ni pagos.</p>
    </ConfirmedForm>
  )
}
ClaimForm.propTypes = {
  warranty: PropTypes.object.isRequired,
  claims: PropTypes.array.isRequired,
  branches: PropTypes.array.isRequired,
  defaultBranch: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}

export const ResolutionForm = ({ claim, busy, onSave }) => {
  const next = claimTransitions[claim.estado] || []
  const [values, setValues] = useState({
    estado: next.length === 1 ? next[0] : '',
    solucion: claim.solucion || '',
    diagnostico: claim.diagnostico || '',
    observacion: claim.observacion || '',
  })
  const actual = {
    ...values,
    solucion:
      values.estado === 'EN_REVISION'
        ? null
        : values.estado === 'RECHAZADO' || claim.estado === 'RECHAZADO'
          ? 'SIN_COBERTURA'
          : values.solucion || null,
  }
  const change = (e) => setValues({ ...values, [e.target.name]: e.target.value })
  const allowed =
    claim.estado === 'RECHAZADO' || values.estado === 'RECHAZADO'
      ? ['SIN_COBERTURA']
      : solutions.filter((s) => s !== 'SIN_COBERTURA')
  return (
    <ConfirmedForm
      id="claim-resolve"
      busy={busy}
      label="Guardar transición del reclamo"
      validate={() => validateResolution(actual, claim)}
      onSave={() => onSave(actual)}
    >
      <p>
        Reclamo {claim.numero_reclamo} · Estado actual: {claim.estado}
      </p>
      <CFormSelect
        id="claim-next-state"
        className="mb-3"
        label="Siguiente estado permitido"
        name="estado"
        value={values.estado}
        onChange={change}
      >
        <option value="">Selecciona estado</option>
        {next.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </CFormSelect>
      {values.estado && values.estado !== 'EN_REVISION' && (
        <CFormSelect
          id="claim-solution"
          className="mb-3"
          label="Solución registrada"
          name="solucion"
          disabled={actual.solucion === 'SIN_COBERTURA'}
          value={actual.solucion || ''}
          onChange={change}
        >
          <option value="">Sin solución todavía</option>
          {allowed.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </CFormSelect>
      )}
      <CFormTextarea
        id="claim-diagnosis"
        className="mb-3"
        label="Diagnóstico (obligatorio para decidir o resolver)"
        name="diagnostico"
        value={values.diagnostico}
        onChange={change}
      />
      <CFormTextarea
        id="claim-resolution-observation"
        className="mb-3"
        label="Observación (opcional; reemplaza la anterior)"
        name="observacion"
        value={values.observacion}
        onChange={change}
      />
      <CAlert color="info">
        Las soluciones registran una decisión. REEMPLAZO y DEVOLUCION no sustituyen dispositivos ni
        devuelven dinero automáticamente.
      </CAlert>
    </ConfirmedForm>
  )
}
ResolutionForm.propTypes = {
  claim: PropTypes.object.isRequired,
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
}
