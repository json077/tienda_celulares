import React from 'react'
import ContactDirectory from '../../components/contacts/ContactDirectory'
import { supplierService } from '../../services/supplierService'

export const supplierConfig = {
  title: 'Proveedores',
  singular: 'proveedor',
  idKey: 'id_proveedor',
  displayName: (record) => record.nombre,
  fields: [
    {
      name: 'nombre',
      label: 'Nombre del proveedor',
      maxLength: 160,
      required: true,
      fullWidth: true,
    },
    { name: 'tipo_identificacion', label: 'Tipo de identificación', maxLength: 30 },
    { name: 'identificacion', label: 'Identificación', maxLength: 50 },
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

const Suppliers = () => <ContactDirectory config={supplierConfig} service={supplierService} />

export default Suppliers
