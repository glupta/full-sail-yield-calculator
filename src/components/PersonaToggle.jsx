/**
 * PersonaToggle - Tab-style toggle between LP and Token Buyer modes
 */

export default function PersonaToggle({ persona, onChange }) {
    return (
        <div className="tab-group" style={{ maxWidth: '400px' }}>
            <button
                className={`tab ${persona === 'lp' ? 'active' : ''}`}
                onClick={() => onChange('lp')}
                aria-pressed={persona === 'lp'}
            >
                Liquidity
            </button>
            <button
                className={`tab ${persona === 'buyer' ? 'active' : ''}`}
                onClick={() => onChange('buyer')}
                aria-pressed={persona === 'buyer'}
            >
                SAIL
            </button>
        </div>
    );
}
