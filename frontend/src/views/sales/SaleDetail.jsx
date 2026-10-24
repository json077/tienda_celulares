import React from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import SaleSummary from './SaleSummary'
import { money } from './saleModel'

const SaleDetail = ({ sale, invoice, payments, warnings }) => (
  <>
    <SaleSummary sale={{ ...sale, detalles: invoice?.detalles || sale.detalles }} />
    {sale.estado !== 'BORRADOR' &&
      !invoice &&
      sale.detalles.some((l) => l.tipo_control === 'SERIALIZADO') && (
        <CAlert color="warning">
          Los IMEI asociados a esta venta solo se consultan mediante factura. El backend permite
          consultarla para ventas CONFIRMADA con permiso FACTURA_IMPRIMIR; el detalle de venta no
          devuelve esas unidades.
        </CAlert>
      )}
    {warnings.map((w) => (
      <CAlert color="warning" key={w}>
        {w}
      </CAlert>
    ))}
    <p>
      ID venta: {sale.id_venta} · ID cliente: {sale.id_cliente} · ID sucursal: {sale.id_sucursal} ·
      ID usuario: {sale.id_usuario}
      <br />
      Creado: {sale.created_at} · Actualizado: {sale.updated_at}
    </p>
    <details>
      <summary>Datos históricos de los detalles</summary>
      {sale.detalles.map((l) => (
        <p key={l.id_detalle_venta}>
          Detalle #{l.id_detalle_venta} · Producto #{l.id_producto}: {l.producto} · Costo unitario
          NIO: {money(l.costo_unitario)} · Garantía: {l.dias_garantia} días
        </p>
      ))}
    </details>
    {invoice && (
      <p>
        Factura: {invoice.serie} / {invoice.numero_factura} · ID {invoice.id_factura} ·{' '}
        {invoice.estado} · Emisión: {invoice.fecha_emision}
      </p>
    )}
    <h5 className="mt-3">Pagos relacionados</h5>
    {payments === null ? (
      <p>Pagos no consultados. No se puede determinar el saldo.</p>
    ) : (
      <>
        <CTable responsive>
          <CTableHead>
            <CTableRow>
              {[
                'ID / Fecha',
                'Método / referencia',
                'Moneda',
                'Monto',
                'Tipo de cambio',
                'Monto base NIO',
                'Estado / caja / usuario',
              ].map((h) => (
                <CTableHeaderCell key={h}>{h}</CTableHeaderCell>
              ))}
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {payments.map((p) => (
              <CTableRow key={p.id_pago}>
                <CTableDataCell>
                  {p.id_pago} · {p.fecha}
                </CTableDataCell>
                <CTableDataCell>
                  {p.metodo} · {p.referencia}
                </CTableDataCell>
                <CTableDataCell>{p.moneda}</CTableDataCell>
                <CTableDataCell>{money(p.monto)}</CTableDataCell>
                <CTableDataCell>{p.tipo_cambio}</CTableDataCell>
                <CTableDataCell>{money(p.monto_base)}</CTableDataCell>
                <CTableDataCell>
                  {p.estado} · {p.id_sesion_caja || '—'} · {p.usuario}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
        {!payments.length && <p>No hay pagos registrados.</p>}
        <p>
          Pagado aplicado: C${' '}
          {money(
            payments
              .filter((p) => p.estado === 'APLICADO')
              .reduce((sum, p) => sum + Number(p.monto_base), 0),
          )}
        </p>
      </>
    )}
    <CAlert color="info">
      Confirmar no registra cobros ni abre caja. Los pagos y planes de crédito se gestionan mediante
      operaciones separadas del backend.
    </CAlert>
  </>
)
SaleDetail.propTypes = {
  sale: PropTypes.object.isRequired,
  invoice: PropTypes.object,
  payments: PropTypes.array,
  warnings: PropTypes.array.isRequired,
}
export default SaleDetail
