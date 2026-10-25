import React from 'react'
import PropTypes from 'prop-types'
import { CBadge } from '@coreui/react'
import { inventoryLabel, stockLevel, unitStateColor } from './inventoryView'

export const StockLevelBadge = ({ row }) => (
  <CBadge color={{ low: 'warning', normal: 'success', unknown: 'secondary' }[stockLevel(row)]}>
    {{ low: 'Stock bajo', normal: 'Sobre el mínimo', unknown: 'No disponible' }[stockLevel(row)]}
  </CBadge>
)
StockLevelBadge.propTypes = { row: PropTypes.object.isRequired }

export const UnitStateBadge = ({ state }) => (
  <CBadge color={unitStateColor(state)}>{inventoryLabel(state)}</CBadge>
)
UnitStateBadge.propTypes = { state: PropTypes.string }
