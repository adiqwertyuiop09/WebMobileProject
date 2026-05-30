import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="5.5" height="5.5" rx="1" /><rect x="10.5" y="2" width="5.5" height="5.5" rx="1" /><rect x="2" y="10.5" width="5.5" height="5.5" rx="1" /><rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1" />
      </svg>
    ),
  },
  {
    path: '/units',
    label: 'Units',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 15V7l6-4.5L15 7v8" /><path d="M7 15v-4h4v4" />
      </svg>
    ),
  },
  {
    path: '/tenants',
    label: 'Tenants',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="5.5" r="3" /><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
  },
  {
    path: '/payments',
    label: 'Payments',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="14" height="10" rx="2" /><path d="M2 8h14" />
      </svg>
    ),
  },
  {
    path: '/maintenance',
    label: 'Maintenance',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 4.3l-6.5 6.5a2 2 0 002.8 2.8l6.5-6.5a2.8 2.8 0 10-2.8-2.8z" /><path d="M8 10l2.5 2.5" />
      </svg>
    ),
  },
  {
    path: '/announcements',
    label: 'Announcements',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11V7a5 5 0 0110 0v4" /><path d="M2 12h14v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1z" />
      </svg>
    ),
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14V8" /><path d="M7 14V4" /><path d="M10 14V9" /><path d="M13 14V6" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2m0 11v2m-6.5-9h2m11 0h2M3.1 3.1l1.4 1.4m9 9l1.4 1.4M3.1 14.9l1.4-1.4m9-9l1.4-1.4" />
      </svg>
    ),
  },
]

const logoutIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 2H4a2 2 0 00-2 2v10a2 2 0 002 2h3" /><path d="M11 13l4-4-4-4" /><path d="M15 9H7" />
  </svg>
)

export default function Sidebar() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#2B1F17]">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <span className="text-[13px] font-semibold text-white tracking-wide">
          Apartment Admin
        </span>
        <p className="text-[11px] text-[#A89080] mt-0.5 tracking-normal font-normal">
          Property management
        </p>
      </div>

      <div className="mx-4 h-px bg-[#3E2F24]" />

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors ${
                    isActive
                      ? 'text-white bg-[#3E2F24]'
                      : 'text-[#C4B0A2] hover:text-white hover:bg-[#3E2F24]/50'
                  }`
                }
              >
                <span className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4">
        <div className="h-px bg-[#3E2F24] mx-2 mb-3" />
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] text-[#C4B0A2] hover:text-white hover:bg-[#3E2F24]/50 transition-colors"
        >
          <span className="flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
            {logoutIcon}
          </span>
          <span>Log out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#2B1F17] border-b border-[#3E2F24] px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-white tracking-wide">Apartment Admin</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-[#C4B0A2] hover:text-white p-1 -mr-1"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full z-50 w-60 transform transition-transform duration-200 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col w-56 flex-shrink-0 h-screen sticky top-0 border-r border-[#3E2F24]">
        <SidebarContent />
      </div>
    </>
  )
}