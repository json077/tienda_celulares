import React from 'react'
import PropTypes from 'prop-types'
import { formatInventoryDate, inventoryLabel } from './inventoryView'

const InventoryMovementDetail = ({ movement }) => (
  <dl className="mb-0">
    <dt>Fecha</dt>
    <dd>{formatInventoryDate(movement.fecha)}</dd>
    <dt>Producto / SKU</dt>
    <dd>
      {movement.producto} · {movement.sku}
    </dd>
    <dt>Sucursal</dt>
    <dd>{movement.sucursal}</dd>
    <dt>Tipo y cantidad</dt>
    <dd>
      {inventoryLabel(movement.tipo)} · {movement.cantidad}
    </dd>
    <dt>Stock anterior → nuevo</dt>
    <dd>
      {movement.stock_anterior} → {movement.stock_nuevo}
    </dd>
    <dt>Unidad</dt>
    <dd>{movement.id_unidad ?? '—'}</dd>
    <dt>Referencia / origen</dt>
    <dd>
      {movement.tipo_referencia || '—'}
      {movement.id_referencia != null ? ` #${movement.id_referencia}` : ''}
    </dd>
    <dt>Usuario</dt>
    <dd>
      {movement.usuario} (ID {movement.id_usuario})
    </dd>
    <dt>Observación</dt>
    <dd className="text-break">{movement.observacion || '—'}</dd>
  </dl>
)
InventoryMovementDetail.propTypes = { movement: PropTypes.object.isRequired }
export default InventoryMovementDetail
