/**
 * PersonaToggle - Tab-style toggle between LP, SAIL, and veSAIL Market modes
 * Enhanced with icons and improved accessibility
 */
import { Droplets, Coins, TrendingUp } from 'lucide-react';

export default function PersonaToggle({ persona, onChange }) {
    return (
        <div
            className="tab-group"
            style={{ maxWidth: '500px' }}
            role="tablist"
            aria-label="Calculator type"
        >
            <button
                className={`tab ${persona === 'lp' ? 'active' : ''}`}
                onClick={() => onChange('lp')}
                aria-selected={persona === 'lp'}
                role="tab"
                id="tab-lp"
                aria-controls="panel-lp"
            >
                <Droplets size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Liquidity
            </button>
            <button
                className={`tab ${persona === 'buyer' ? 'active' : ''}`}
                onClick={() => onChange('buyer')}
                aria-selected={persona === 'buyer'}
                role="tab"
                id="tab-sail"
                aria-controls="panel-sail"
            >
                <Coins size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                SAIL
            </button>
            <button
                className={`tab ${persona === 'vesail' ? 'active' : ''}`}
                onClick={() => onChange('vesail')}
                aria-selected={persona === 'vesail'}
                role="tab"
                id="tab-vesail"
                aria-controls="panel-vesail"
            >
                <TrendingUp size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                veSAIL
            </button>
        </div>
    );
}
