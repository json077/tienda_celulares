import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { CIcon } from '@coreui/icons-react'
import { cilUser } from '@coreui/icons'
import { useProfilePhoto } from '../contexts/ProfileContext'

const ProfileAvatar = ({ name, large = false }) => {
  const { url } = useProfilePhoto()
  const [failed, setFailed] = useState(null)
  return (
    <span
      className={`profile-avatar${large ? ' profile-avatar-large' : ''}`}
      role="img"
      aria-label={`Avatar de ${name}`}
    >
      {url && failed !== url ? (
        <img src={url} alt="" onError={() => setFailed(url)} />
      ) : (
        <CIcon icon={cilUser} customClassName="profile-avatar-symbol" aria-hidden="true" />
      )}
    </span>
  )
}
ProfileAvatar.propTypes = { name: PropTypes.string.isRequired, large: PropTypes.bool }
export default ProfileAvatar
