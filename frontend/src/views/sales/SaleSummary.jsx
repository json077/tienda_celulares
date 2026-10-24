import React from 'react'
import PropTypes from 'prop-types'
import {
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { money, unitLabel } from './saleModel'

const SaleSummary = ({ sale }) => (
  <section>
    <h4>{sale.numero_factura || sale.numero_venta}</h4>
    {sale.id_venta && (
      <p>
        Venta #{sale.id_venta} · Número {sale.numero_venta}
      </p>
    )}
    <p>
      Cliente: {sale.nombre_cliente || sale.cliente} · Identificación:{' '}
      {sale.identificacion_cliente || '—'}
      <br />
      Sucursal: {sale.sucursal} {sale.codigo_sucursal} · Vendedor: {sale.usuario || '—'}
      <br />
      Fecha: {sale.fecha_emision || sale.fecha || 'Pendiente de registro'} · Estado:{' '}
      {sale.estado || 'Nuevo borrador'} · Condición: {sale.tipo_venta}
      <br />
      {sale.direccion_cliente} {sale.direccion_sucursal} {sale.telefono_sucursal}
    </p>
    <CTable responsive bordered>
      <CTableHead>
        <CTableRow>
          {[
            'Producto / SKU',
            'Control / unidades',
            'Cantidad',
            'Precio NIO',
            'Descuento',
            'Impuesto',
            'Importe',
          ].map((h) => (
            <CTableHeaderCell key={h}>{h}</CTableHeaderCell>
          ))}
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {sale.detalles.map((l, i) => (
          <CTableRow key={l.id_detalle_venta || i}>
            <CTableDataCell>
              {l.producto}
              <br />
              {l.sku}
            </CTableDataCell>
            <CTableDataCell>
              {l.tipo_control}
              {l.unidades?.map((u) => (
                <div key={u.id_unidad}>{unitLabel(u)}</div>
              ))}
            </CTableDataCell>
            <CTableDataCell>{l.cantidad}</CTableDataCell>
            <CTableDataCell>{money(l.precio_unitario)}</CTableDataCell>
            <CTableDataCell>{money(l.descuento)}</CTableDataCell>
            <CTableDataCell>{money(l.impuesto)}</CTableDataCell>
            <CTableDataCell>{money(l.subtotal)}</CTableDataCell>
          </CTableRow>
        ))}
      </CTableBody>
    </CTable>
    <p>
      Subtotal: {money(sale.subtotal)} · Descuento: {money(sale.descuento)} · Impuestos:{' '}
      {money(sale.impuesto)}
    </p>
    <h5>Total: C$ {money(sale.total)} (NIO)</h5>
    <p>{sale.observacion}</p>
  </section>
)
SaleSummary.propTypes = { sale: PropTypes.object.isRequired }
export default SaleSummary
