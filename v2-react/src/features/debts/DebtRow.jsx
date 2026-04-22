import { calculateMinimumPayment } from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

function DebtRow({ debt, onDelete }) {
  return (
    <li className="debt-item">
      <div className="debt-info">
        <span className="debt-name">{debt.name}</span>
        <span className="debt-meta">
          {formatMoney(debt.balance)} · {debt.rate}% APR · min{" "}
          {formatMoney(calculateMinimumPayment(debt))}
        </span>
      </div>
      <div className="debt-actions">
        <button
          type="button"
          className="btn-delete"
          onClick={() => onDelete(debt.id)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export default DebtRow;
