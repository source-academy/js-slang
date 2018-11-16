// File: contest_8-1_1.js
function console_log(x) {
	return display(x);
}
function search_log(x) {
	//return console_log(x);
}
function error_on(condition, message) {
	if (condition) {
		//throw message;
	} else {}
}

/// \param[in] number_of_crystals        The number of crystals we are allowed to break.
///                                      This will be in the range [3*number_of_params, 200].
/// \param[in] number_of_params          The number of parameters we need to determine
///                                      This will be in the range [1, 10].
/// \param[in] force_quantity_upperbound The upper bounds of each parameter. This must
///                                      be a list of items with length = number_of_params
/// \remarks This must return within 2 minutes.
function force_crystal(number_of_crystals, number_of_params, force_quantity_upperbound) {
	if (length(force_quantity_upperbound) !== number_of_params) {
		return "Insufficient upper bounds for number of parameters";
	} else {}
	
	//We have a few algorithms for deciding on ONE parameter of each crystal.
	//The fastest is a binary search. But that would require log2(param) *
	//number_of_params crystals.
	//The slowest but most crystal-preserving algorithm is a linear search
	//from the minimum bound to the maximum bound.
	//So we need to take a hybrid of both. Since we are given at least N*3
	//crystals, we will use the binary search first to reduce our search area
	//then use linear search to find the parameter that breaks.
	
	//The next problem is deciding how many crystals we want to allocate for
	//each parameter. Naively, since we have 3*N crystals, we would allocate
	//number_of_crystals / number_of_params crystals for this task.
	
	/// Determines one parameter of the crystal.
	/// \param[in] number_of_crystals           Number of crystals allocated for this
	///                                         parameter.
	/// \param[in] determined_force_quantities  The list of quantities which we have
	///                                         already determined. We are determining
	///                                         the next one in this function.
	/// \param[in] quantity_upperbound          The upper bound for the current parameter.
	/// \return A pair, containing the parameter as head, and tail as the number
	///         of crystals left. The parameter is the precise maximum which cannot be
	///         exceeded.
	function determine_one_parameter(number_of_crystals, determined_force_quantities, quantity_upperbound) {
		search_log("Determining bounds in [0, " + quantity_upperbound + "]");
		
		/// Helper to call force_aura with the information we're provided.
		/// \param[in] The parameter to attempt on the crystal.
		function force_aura_helper(this_param) {
			var attempt = append(
					append(determined_force_quantities, list(this_param)),
					build_list(
						number_of_params - length(determined_force_quantities) - 1,
						function(x) {
							return 0;
						}
					)
				);

			error_on(length(attempt) !== number_of_params, "FORCE_AURA_WRONG_PARAM");
			return force_aura(attempt);
		}
		
		/// \param[in] min The inclusive minimum value of the range
		/// \param[in] max The inclusive maximum value of the range
		/// \remark This function must only break at most ONE crystal.
		function linear_search(min, max) {
			search_log("LSearch: " + min + ", " + max);
			error_on(min > max, "Bounds inconsistent");
			if (min === max) {
				//We got our answer
				return min;
			} else {
				if (force_aura_helper(min + 1)) {
					//Crystal doesn't break, try next
					return linear_search(min + 1, max);
				} else {
					//Crystal broke. One less than min.
					return min;
				}
			}
		}
		
		/// \param[in] min The inclusive minimum value of the range
		/// \param[in] max The inclusive maximum value of the range
		function binary_split(number_of_crystals_left, min, max) {
			search_log("BSearch: " + number_of_crystals_left + ", " + min + ", " + max);
			error_on(number_of_crystals_left === 0, "Used all crystals allocated");
			if (min === max) {
				//We got our answer!
				return pair(max, number_of_crystals_left);
			} else if (number_of_crystals_left === 1 || min + 1 === max) {
				//If we only have one crystal left, we need to use linear search.
				//This is also used to tie-break when we only have two solutions.
				return pair(linear_search(min, max), number_of_crystals_left - 1);
			} else {
				//We still have spare crystals. Try to test the midpoint.
				var midpoint = Math.floor((min + max) / 2);
				
				if (force_aura_helper(midpoint)) {
					//The crystal didn't break. Test the upper half of the range.
					return binary_split(number_of_crystals_left, midpoint, max);
				} else {
					//The crystal broke. The maximum param is one less than our midpoint.
					return binary_split(number_of_crystals_left - 1, min, midpoint - 1);
				}
			}
		}
		
		return binary_split(number_of_crystals, 0, quantity_upperbound);
	}
	
	/// This allocates crystals for solving a parameter.
	/// \param[in] number_of_crystals_left      The number of crystals left
	/// \param[in] determined_force_quantities  The values we've already determined.
	/// \param[in] force_quantity_upperbounds   The upper bounds of the remaining parameters
	///                                         to determine.
	/// \return    A list of parameters number_of_params long.
	function determine_parameters(number_of_crystals_left, determined_force_quantities, force_quantity_upperbounds) {
		//Bail out if we are done.
		if (is_empty_list(force_quantity_upperbounds)) {
			return determined_force_quantities;
		} else {}
		
		//Calculate how many crystals we want to allocate to this element.
		var remaining_search_bounds = accumulate(
			function(x, y) { return x + y; },
			0,
			force_quantity_upperbounds
		);
		var wanted_allocation = Math.floor(head(force_quantity_upperbounds) /
				remaining_search_bounds * number_of_crystals_left) + 1;
		var crystals_for_this_try = Math.min(
			Math.max(wanted_allocation, 2),
			number_of_crystals_left);
		var parameter = determine_one_parameter(crystals_for_this_try,
			determined_force_quantities,
			head(force_quantity_upperbounds));
		console_log("Parameter: " + head(parameter) + ", " + tail(parameter) + "/" + crystals_for_this_try + " crystals left");
		
		return determine_parameters(
			number_of_crystals_left - (crystals_for_this_try - tail(parameter)),
			append(determined_force_quantities, list(head(parameter))),
			tail(force_quantity_upperbounds));
	}
	
	//list(1, 5, 3) for the 3 parameters.
	var result = determine_parameters(number_of_crystals, [], force_quantity_upperbound);
	console_log(result);
	error_on(!force_aura_finalise(result), "Wrong answer");
}

//force_crystal(1, 1, list(10));
start_test(10, 2, list(10, 10), list(3, 8));
display("\r\n");

//Test binary search fallback with small sizes
start_test(6, 2, list(4, 4), list(1, 2));
display("\r\n");

//Test binary search with odd number of hops.
start_test(10, 2, list(9, 9), list(3, 8));
display("\r\n");

//Test cases.
//If the params are equal to upper bounds, we should not break ANY crystal.
start_test(10, 2, list(500000, 500000), list(500000, 500000));
display("\r\n");

//Test transition to linear search
start_test(6, 2, list(25000, 100000), list(24995, 50000));
display("\r\n");

//Larger number of parameters
start_test(21, 7, list(12500, 100000, 100000,100000,100000,100000,100000), list(11395, 50000, 21738, 31210, 87432, 69543, 54734));
display("\r\n");

//Larger number of parameters
start_test(30, 7, list(12500, 135000, 100000,24000,100000,100000,40000), list(11395, 132504, 21738, 23950, 87432, 69543, 24103));
display("\r\n");

//Larger number of parameters
start_test(21, 7, list(12500, 51000, 25000, 32000, 90000, 70000, 55000), list(11395, 50000, 21738, 31210, 87432, 69543, 54734));
display("\r\n");

//Skewed data set
//Larger number of parameters
start_test(21, 7, list(12500, 10, 10, 10, 10, 10,500000), list(11395, 7, 3, 1, 2, 0, 253734));
display("\r\n");
