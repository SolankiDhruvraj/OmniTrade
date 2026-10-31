import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export const CustomSelect = ({ value, onChange, options = [], placeholder = 'Select an option', disabled = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedOption = options.find((opt) => String(opt.value) === String(value))

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (val) => {
    if (disabled) return
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div className={`custom-dropdown-container ${disabled ? 'disabled' : ''} ${className}`} ref={dropdownRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`custom-dropdown-trigger ${isOpen ? 'open' : ''}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        <span className={`custom-dropdown-value ${!selectedOption ? 'placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`custom-dropdown-arrow ${isOpen ? 'rotated' : ''}`} size={15} />
      </button>

      {isOpen && (
        <ul className="custom-dropdown-menu" role="listbox">
          {options.map((option) => {
            const isSelected = String(option.value) === String(value)
            return (
              <li
                aria-selected={isSelected}
                className={`custom-dropdown-item ${isSelected ? 'selected' : ''}`}
                key={option.value}
                onClick={() => handleSelect(option.value)}
                role="option"
              >
                <span>{option.label}</span>
                {isSelected && <Check className="custom-dropdown-check" size={14} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
