import React from 'react'
import ContactDirectory from '../../components/contacts/ContactDirectory'
import { customerService } from '../../services/customerService'
import {
  clientName,
  clientList,
  normalizeClient,
  filterClients,
  validateClient,
} from './clientModel'

export const customerConfig = {
  permissions: {
    create: 'CLIENTES_CREAR',
    edit: 'CLIENTES_EDITAR',
    deactivate: 'CLIENTES_ELIMINAR',
  },
  title: 'Clientes',
  singular: 'cliente',
  idKey: 'id_cliente',
  displayName: clientName,
  readList: clientList,
  readRecord: normalizeClient,
  filter: filterClients,
  validate: validateClient,
  stateFilter: true,
  hideId: true,
  fields: [
    { name: 'tipo_identificacion', label: 'Tipo de identificación', maxLength: 30, required: true },
    { name: 'identificacion', label: 'Identificación', maxLength: 50, required: true },
    {
      name: 'nombres',
      label: 'Nombres',
      maxLength: 100,
      required: true,
      autoComplete: 'given-name',
    },
    { name: 'apellidos', label: 'Apellidos', maxLength: 100, autoComplete: 'family-name' },
    { name: 'telefono', label: 'Teléfono', maxLength: 30, type: 'tel', autoComplete: 'tel' },
    {
      name: 'email',
      label: 'Correo electrónico',
      maxLength: 150,
      type: 'email',
      autoComplete: 'email',
    },
    { name: 'direccion', label: 'Dirección', maxLength: 255, multiline: true },
  ],
}

const Customers = () => <ContactDirectory config={customerConfig} service={customerService} />

export default Customers
